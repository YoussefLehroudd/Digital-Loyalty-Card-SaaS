<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBusinessProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $businessId = $this->user()?->business_id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email:rfc',
                'max:255',
                Rule::unique('businesses', 'email')->ignore($businessId),
            ],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:1000'],
            'primary_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'hero_image_url' => ['nullable', 'string', 'max:2048'],
            'hero_image_public_id' => ['nullable', 'string', 'max:255'],
            'hero_image_zoom' => ['nullable', 'numeric', 'min:1', 'max:3'],
            'hero_image_position_x' => ['nullable', 'numeric', 'min:-50', 'max:50'],
            'hero_image_position_y' => ['nullable', 'numeric', 'min:-50', 'max:50'],
        ];
    }
}
