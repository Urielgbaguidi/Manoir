<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdatePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Un compte cree via Google n'a pas d'ancien mot de passe : il en definit
     * un (la reauthentification recente fait office de preuve d'identite).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $hasPassword = filled($this->user()?->getAuthPassword());

        return [
            'current_password' => [$hasPassword ? 'required' : 'nullable', 'string', 'max:255'],
            'password' => [
                'required',
                'string',
                'max:255',
                'confirmed',
                Password::min(8)->letters()->numbers(),
                ...($hasPassword ? ['different:current_password'] : []),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.confirmed' => 'Les deux nouveaux mots de passe ne correspondent pas.',
            'password.different' => 'Le nouveau mot de passe doit etre different de l ancien.',
        ];
    }
}
