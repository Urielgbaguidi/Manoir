<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Confirmation d'identite avant une action sensible : mot de passe, ou pour un
 * compte sans mot de passe (Google), un nouveau jeton Google ou un code 2FA.
 */
class ReauthenticateRequest extends FormRequest
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
            'password' => ['required_without_all:credential,code', 'nullable', 'string', 'max:255'],
            'credential' => ['required_without_all:password,code', 'nullable', 'string', 'max:4096'],
            'code' => ['required_without_all:password,credential', 'nullable', 'string', 'regex:/^\d{6}$/'],
        ];
    }
}
