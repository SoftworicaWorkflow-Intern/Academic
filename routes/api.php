<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('api.login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', [AuthController::class, 'user'])->name('api.user');
    Route::post('/logout', [AuthController::class, 'logout'])->name('api.logout');

    Route::prefix('admin')
        ->middleware(['platform.context', 'permission:platform.access'])
        ->group(function (): void {
            Route::get('/dashboard', [DashboardController::class, 'platform'])
                ->name('api.admin.dashboard');
        });

    Route::prefix('institution')
        ->middleware(['institution.context', 'permission:institution.access'])
        ->group(function (): void {
            Route::get('/dashboard', [DashboardController::class, 'institution'])
                ->name('api.institution.dashboard');
        });
});
