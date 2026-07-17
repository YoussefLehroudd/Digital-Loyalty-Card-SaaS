<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class CreateCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }

    /**
     * @return mixed
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated($key, $default);

        if (! is_array($validated)) {
            return $validated;
        }

        if (array_key_exists('phone', $validated) && $validated['phone'] === '') {
            $validated['phone'] = null;
        }

        if (array_key_exists('email', $validated) && $validated['email'] === '') {
            $validated['email'] = null;
        }

        return $validated;
    }
}
