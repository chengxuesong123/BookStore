<?php
declare(strict_types=1);

namespace app\controller\api;

use app\exception\ApiException;
use app\model\User as UserModel;
use think\facade\Session;

class Account extends ApiBase
{
    /**
     * 修改昵称
     */
    public function updateProfile()
    {
        $user = $this->requireUser();
        $nickname = trim((string) ($this->body()['nickname'] ?? ''));

        if (mb_strlen($nickname) < 2 || mb_strlen($nickname) > 20) {
            throw new ApiException(42200, '昵称需要 2–20 个字', 422, ['errors' => ['nickname' => '昵称需要 2–20 个字']]);
        }

        $model = UserModel::find((int) $user['id']);
        $model->save(['nickname' => $nickname]);
        Session::set('user', $model->toSession());

        return $this->ok(['user' => $this->userArray($model)], '昵称已更新');
    }

    /**
     * 上传头像：真实 MIME 校验 + 随机文件名
     */
    public function uploadAvatar()
    {
        $user = $this->requireUser();
        $file = $this->request->file('avatar');

        if ($file === null) {
            throw new ApiException(42200, '请选择图片文件', 422, ['errors' => ['avatar' => '请选择图片文件']]);
        }
        if ($file->getSize() > 2 * 1024 * 1024) {
            throw new ApiException(42200, '头像不能超过 2MB', 422, ['errors' => ['avatar' => '头像不能超过 2MB']]);
        }

        $mimeMap = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
        ];
        $mime = (string) $file->getMime();
        if (!isset($mimeMap[$mime])) {
            throw new ApiException(42200, '只支持 jpg / png / webp 图片', 422, ['errors' => ['avatar' => '只支持 jpg / png / webp']]);
        }

        $dir = app()->getRootPath() . 'public/uploads/avatars/';
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new ApiException(50000, '头像保存失败', 500);
        }

        $name = $user['id'] . '-' . bin2hex(random_bytes(4)) . '.' . $mimeMap[$mime];
        $file->move($dir, $name);

        $model = UserModel::find((int) $user['id']);
        $old = (string) ($model['avatar'] ?? '');
        $model->save(['avatar' => '/uploads/avatars/' . $name]);

        // 旧头像只删自己目录里的文件
        if ($old !== '' && str_starts_with($old, '/uploads/avatars/')) {
            $oldPath = $dir . basename($old);
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        return $this->ok(['user' => $this->userArray($model)], '头像已更新');
    }

    private function userArray(UserModel $user): array
    {
        return [
            'id'         => (int) $user['id'],
            'email'      => (string) $user['email'],
            'nickname'   => (string) $user['nickname'],
            'role'       => (string) $user['role'],
            'avatar'     => (string) ($user['avatar'] ?? ''),
            'created_at' => (string) ($user['created_at'] ?? ''),
        ];
    }
}
