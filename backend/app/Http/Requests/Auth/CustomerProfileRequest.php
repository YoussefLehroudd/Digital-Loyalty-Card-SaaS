<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class CustomerProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'preferences' => ['nullable', 'array'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            // email is present in requirements; allow update if provided
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }
}
