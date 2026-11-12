<?php
declare(strict_types=1);

namespace app\exception;

use Exception;

/**
 * 业务异常：由统一异常处理转成 {code,msg,data} 的 JSON
 */
class ApiException extends Exception
{
    private int $apiCode;

    private int $status;

    private array $extra;

    public function __construct(int $apiCode, string $message, int $status = 400, array $extra = [])
    {
        parent::__construct($message);
        $this->apiCode = $apiCode;
        $this->status  = $status;
        $this->extra   = $extra;
    }

    public function getApiCode(): int
    {
        return $this->apiCode;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getExtra(): array
    {
        return $this->extra;
    }
}
