<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Parametres communs des tableaux de l'administration (pagination, tri,
 * recherche et filtres cote serveur, a la maniere de DataTables).
 */
class AdminTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    protected function prepareForValidation(): void
    {
        foreach (['search', 'client'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field)) ?: null]);
            }
        }

        // `status` accepte une liste separee par des virgules.
        if (is_string($this->input('status'))) {
            $this->merge(['status' => array_values(array_filter(array_map('trim', explode(',', $this->input('status')))))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'search' => ['nullable', 'string', 'max:100'],
            'client' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'array'],
            'status.*' => ['string', 'max:40', 'regex:/^[A-Z_]+$/'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'date_field' => ['nullable', 'in:stay,created'],
            'sort' => ['nullable', 'string', 'max:40'],
            'direction' => ['nullable', 'in:asc,desc'],
            'is_admin' => ['nullable', 'boolean'],
            'verified' => ['nullable', 'boolean'],
        ];
    }

    public function perPage(): int
    {
        return (int) ($this->validated('per_page') ?? 25);
    }

    public function direction(): string
    {
        return (string) ($this->validated('direction') ?? 'desc');
    }

    /**
     * Colonne de tri, limitee a une liste blanche (jamais de nom de colonne
     * libre dans la requete SQL).
     *
     * @param  array<string, string>  $allowed  cle publique => colonne SQL
     */
    public function sortColumn(array $allowed, string $default): string
    {
        $sort = (string) ($this->validated('sort') ?? '');

        return $allowed[$sort] ?? $default;
    }

    /**
     * Echappe les jokers SQL d'une recherche libre.
     */
    public function likeTerm(string $value): string
    {
        return '%'.addcslashes($value, '%_\\').'%';
    }
}
