<?php

namespace App\Services;

class MarkCalculator
{
    /**
     * @param  array{theory_marks: int, practical_marks: int, full_marks: int, pass_marks: int, practical_full_marks: int, practical_pass_marks: int}  $input
     * @return array{total: int, maximum: int, percentage: float, grade: string, passed: bool}
     */
    public function score(array $input): array
    {
        $maximum = $input['full_marks'] + $input['practical_full_marks'];
        $total = $input['theory_marks'] + $input['practical_marks'];
        $percentage = $maximum === 0 ? 0.0 : round(($total / $maximum) * 100, 2);
        $passed = $input['theory_marks'] >= $input['pass_marks']
            && $input['practical_marks'] >= $input['practical_pass_marks']
            && $total <= $maximum;

        return [
            'total' => $total,
            'maximum' => $maximum,
            'percentage' => $percentage,
            'grade' => $this->grade($percentage, $passed),
            'passed' => $passed && $percentage >= 40,
        ];
    }

    private function grade(float $percentage, bool $componentPass): string
    {
        if (! $componentPass || $percentage < 40) {
            return 'F';
        }

        return match (true) {
            $percentage >= 90 => 'A+',
            $percentage >= 80 => 'A',
            $percentage >= 70 => 'B+',
            $percentage >= 60 => 'B',
            $percentage >= 50 => 'C',
            default => 'D',
        };
    }
}
