<?php

return [

    'apps' => [

        [
            'id' => env('REVERB_APP_ID'),
            'name' => env('REVERB_APP_NAME', 'default'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'allowed_origins' => [
                '*',
            ],
        ],

    ],

    'host' => env('REVERB_HOST', '127.0.0.1'),

    'port' => env('REVERB_PORT', 8080),

    'scheme' => env('REVERB_SCHEME', 'http'),

    'options' => [
        'tls' => env('REVERB_SCHEME', 'http') === 'https',
        'max_request_size' => env('REVERB_MAX_REQUEST_SIZE', 10),
    ],

];
