<?php

use App\Http\Middleware\AuthenticateCustomerPortalToken;
use App\Http\Middleware\CustomerMiddleware;
use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'json.api' => \App\Http\Middleware\ForceJsonForApi::class,
            'customer_portal_token' => AuthenticateCustomerPortalToken::class,
            'customer' => CustomerMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            // Always return JSON 401 for unauthenticated API requests (no redirects).
            $path = (string) $request->path(); // no leading slash
            $uri = (string) $request->getRequestUri(); // includes leading slash

            $isApiRequest =
                $request->expectsJson() ||
                $request->is('api/*') ||
                str_contains($path, 'api/') ||
                str_starts_with($path, 'api/') ||
                str_starts_with($uri, '/api/');

            if ($isApiRequest) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            // Keep existing web behavior unchanged.
            return null;
        });
    })->create();
