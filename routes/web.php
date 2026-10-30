<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'app')->name('login');

Route::view('/admin/{path?}', 'app')
    ->middleware(['auth', 'platform.context', 'permission:platform.access'])
    ->where('path', '.*')
    ->name('admin.app');

Route::view('/{path}', 'app')
    ->middleware(['auth', 'institution.context', 'permission:institution.access'])
    ->where('path', '(?:dashboard|students|teachers|academics|academic-sessions|classes|courses|subjects|attendance|examinations|results|accounting|fee-structures|invoices|fee-collection|payments|expenses|salary-management|financial-reports|notices|documents|users|settings|profile)(?:/.*)?')
    ->name('institution.app');
