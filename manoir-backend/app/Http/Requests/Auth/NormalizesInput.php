<?php

namespace App\Http\Requests\Auth;

/**
 * Normalisations communes : email en minuscules sans espaces, telephone au
 * format international E.164 (+22901XXXXXXXX), pays en majuscules.
 */
trait NormalizesInput
{
    protected function normalizeEmail(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }
    }

    protected function normalizePhone(): void
    {
        if (! is_string($this->input('phone'))) {
            return;
        }

        $phone = preg_replace('/[\s\-\.\(\)]/', '', trim($this->input('phone')));

        if (str_starts_with((string) $phone, '00')) {
            $phone = '+'.substr((string) $phone, 2);
        }

        $this->merge(['phone' => $phone]);
    }

    protected function normalizeCountry(): void
    {
        if (is_string($this->input('country'))) {
            $this->merge(['country' => strtoupper(trim($this->input('country')))]);
        }
    }

    /**
     * @return array<int, string>
     */
    protected function phoneRules(): array
    {
        return ['required', 'string', 'regex:/^\+[1-9]\d{7,14}$/'];
    }

    /**
     * @return array<string, string>
     */
    protected function phoneMessages(): array
    {
        return [
            'phone.regex' => 'Le numero doit etre au format international, par exemple +229 01 XX XX XX XX.',
        ];
    }
}
