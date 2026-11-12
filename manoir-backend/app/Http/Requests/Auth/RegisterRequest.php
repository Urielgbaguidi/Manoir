<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    use NormalizesInput;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeEmail();
        $this->normalizePhone();
        $this->normalizeCountry();

        if (is_string($this->input('name'))) {
            $this->merge(['name' => preg_replace('/\s+/', ' ', trim($this->input('name')))]);
        }
    }

    /**
     * Pas de regle `unique` sur l'email : elle revelerait qu'un compte existe.
     * Le cas est traite dans le controleur, avec la meme reponse.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'phone' => $this->phoneRules(),
            'country' => ['required', 'string', 'size:2', 'alpha:ascii'],
            'password' => ['required', 'string', 'max:255', Password::min(8)->letters()->numbers()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->phoneMessages();
    }
}
