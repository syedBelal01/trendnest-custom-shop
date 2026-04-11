import { Input } from '@/components/ui/input';
import { clampIndianPhoneInput } from '@/lib/indianPhone';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'maxLength'> & {
  value: string;
  onChange: (value: string) => void;
};

export function IndianPhoneInput({ value, onChange, placeholder, title, ...rest }: Props) {
  return (
    <Input
      {...rest}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={10}
      placeholder={placeholder ?? '9876543210'}
      value={value}
      onChange={e => onChange(clampIndianPhoneInput(e.target.value))}
    />
  );
}
