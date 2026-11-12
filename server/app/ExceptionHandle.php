<?php
namespace app;

use app\exception\ApiException;
use think\db\exception\DataNotFoundException;
use think\db\exception\ModelNotFoundException;
use think\exception\Handle;
use think\exception\HttpException;
use think\exception\HttpResponseException;
use think\exception\ValidateException;
use think\Response;
use Throwable;

/**
 * 应用异常处理：/api/* 一律转成 JSON
 */
class ExceptionHandle extends Handle
{
    protected $ignoreReport = [
        HttpException::class,
        HttpResponseException::class,
        ModelNotFoundException::class,
        DataNotFoundException::class,
        ValidateException::class,
        ApiException::class,
    ];

    public function report(Throwable $exception): void
    {
        parent::report($exception);
    }

    public function render($request, Throwable $e): Response
    {
        $path = ltrim((string) $request->pathinfo(), '/');

        if (str_starts_with($path, 'api/')) {
            if ($e instanceof ApiException) {
                $extra = $e->getExtra();

                return json([
                    'code' => $e->getApiCode(),
                    'msg'  => $e->getMessage(),
                    'data' => $extra ? $extra : null,
                ], $e->getStatus());
            }

            if ($e instanceof ValidateException) {
                return json(['code' => 42200, 'msg' => $e->getMessage(), 'data' => null], 422);
            }

            if ($e instanceof HttpException) {
                $status = $e->getStatusCode();

                return json([
                    'code' => $status * 100,
                    'msg'  => $e->getMessage() ?: '请求失败',
                    'data' => null,
                ], $status);
            }

            $debug = $this->app->isDebug();

            return json([
                'code' => 50000,
                'msg'  => $debug ? $e->getMessage() : '服务器开小差了',
                'data' => null,
            ], 500);
        }

        return parent::render($request, $e);
    }
}
