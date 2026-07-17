<?php

namespace App\Enums;

enum UserRole: string
{
    case PlatformAdmin = 'platform_admin';
    case BusinessOwner = 'business_owner';
    case Customer = 'customer';
}
