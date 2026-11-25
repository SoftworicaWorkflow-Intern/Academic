<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'app')->name('login');

Route::view('/admin/{path?}', 'app')
    ->middleware(['auth', 'platform.context', 'permission:platform.access'])
    ->where('path', '.*')
    ->name('admin.app');

Route::view('/{path}', 'app')
    ->middleware(['auth', 'institution.context', 'permission:institution.access'])
    ->where('path', '(?:dashboard|accountant|teacher|students|teachers|staff|academics|academic-sessions|classes|sections|courses|subjects|timetable|attendance|examinations|results|marks|accounting|fee-structures|bill-settings|invoices|fee-collection|payments|outstanding-fees|expenses|salary-management|financial-reports|notices|documents|users|roles|reports|settings|profile)(?:/.*)?')
    ->name('institution.app');
