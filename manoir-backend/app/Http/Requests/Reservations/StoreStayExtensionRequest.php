<?php

namespace App\Http\Requests\Reservations;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreStayExtensionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'new_check_out' => ['required', 'date_format:Y-m-d', 'after:today'],
        ];
    }
}
