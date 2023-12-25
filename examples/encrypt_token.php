<?php

const CIPHER = 'AES-256-CBC';
const SECRET_KEY = 'MySuperSecretKeyForParamsToken12';

$tokenObject = [
    "connection" => [
        "type" => "rdp",
        "settings" => [
            "hostname" => "10.0.0.12",
            "username" => "Administrator",
            "password" => "pAsSwOrD",
            "enable-drive" => true,
            "create-drive-path" => true,
            "security" => "any",
            "ignore-cert" => true,
            "enable-wallpaper" => false
        ]
    ]
];

function encryptToken($value): string
{
    $iv = random_bytes(16);

    $value = openssl_encrypt(
        json_encode($value),
        CIPHER,
        SECRET_KEY,
        0,
        $iv
    );

    if ($value === false) {
        throw new Exception('Could not encrypt the data.');
    }

    $data = [
        'iv' => base64_encode($iv),
        'value' => $value,
    ];

    $json = json_encode($data);

    if (!is_string($json)) {
        throw new Exception('Could not encrypt the data.');
    }

    return base64_encode($json);
}


$token = encryptToken($tokenObject);

echo "Parameters:" . PHP_EOL;
echo json_encode($tokenObject, JSON_PRETTY_PRINT) . PHP_EOL;

echo PHP_EOL . PHP_EOL;

echo "Encrypted token:" . PHP_EOL;
echo $token . PHP_EOL;

echo PHP_EOL . PHP_EOL;

echo "Use this token in the URL:" . PHP_EOL;
echo "ws://localhost:8080/?token=" . urlencode($token) . PHP_EOL;
