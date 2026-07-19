<?php

namespace App\Http\Requests\LoyaltyCard;

use Illuminate\Foundation\Http\FormRequest;

class CreateLoyaltyCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route middleware handles role; tenant isolation is enforced in controller
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'reward_name' => ['required', 'string', 'min:2', 'max:255'],
            'required_stamps' => ['required', 'integer', 'min:1', 'max:10'],
            'reward_description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('reward_description') && $this->input('reward_description') === '') {
            $this->merge([
                'reward_description' => null,
            ]);
        }
    }
}
