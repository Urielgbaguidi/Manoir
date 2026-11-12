<?php

namespace App\Http\Requests\Reservations;

use App\Models\RoomCategory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('special_requests'))) {
            $this->merge(['special_requests' => trim($this->input('special_requests')) ?: null]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_type' => ['required', 'string', 'in:'.implode(',', RoomCategory::TYPES)],
            'check_in' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'check_out' => ['required', 'date_format:Y-m-d', 'after:check_in'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'guests' => ['nullable', 'integer', 'min:1', 'max:20'],
            'special_requests' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
