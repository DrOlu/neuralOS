import { WindowsSelect } from "./WindowsSelect";

export interface ProfileOption {
  id: string;
  name: string;
}

export function WindowsProfileSelect({
  value,
  options,
  onChange,
  widthCh,
}: {
  value: string;
  options: ProfileOption[];
  onChange: (nextId: string) => void;
  widthCh: number;
}) {
  return (
    <WindowsSelect
      value={value}
      options={options.map((option) => ({
        value: option.id,
        label: option.name,
      }))}
      onChange={onChange}
      widthCh={widthCh}
      className="profile-dropdown windows-profile-select-trigger"
    />
  );
}
