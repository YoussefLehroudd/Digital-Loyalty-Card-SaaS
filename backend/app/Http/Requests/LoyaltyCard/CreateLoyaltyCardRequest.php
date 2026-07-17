<?php

namespace App\Http\Requests\LoyaltyCard;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'required_stamps' => ['required', 'integer', 'min:1'],
            'reward_description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validated(): array
    {
        $validated = parent::validated();

        // Normalize empty string to null if description is omitted/empty.
        if (array_key_exists('reward_description', $validated) && $validated['reward_description'] === '') {
            $validated['reward_description'] = null;
        }

        return $validated;
    }
}
