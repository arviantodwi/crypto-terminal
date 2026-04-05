SELECT instrument,
       timeframe,
       c1_label,
       c2_label,
       c3_label,
       occurrences,
       up_count,
       down_count,
       up_probability,
       down_probability,
       computed_at
FROM public.pattern_probabilities
LIMIT 250;
