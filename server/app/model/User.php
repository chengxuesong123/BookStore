<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 用户（role: customer / admin）
 */
class User extends Model
{
    protected $name = 'users';

    protected $autoWriteTimestamp = false;

    protected $hidden = ['password_hash'];

    public function isAdmin(): bool
    {
        return $this->getAttr('role') === 'admin';
    }

    /**
     * 写入 session 的精简结构
     */
    public function toSession(): array
    {
        return [
            'id'       => (int) $this->getAttr('id'),
            'email'    => (string) $this->getAttr('email'),
            'nickname' => (string) $this->getAttr('nickname'),
            'role'     => (string) $this->getAttr('role'),
        ];
    }
}
