

interface TextFieldProps {
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export function TextField({
  startAdornment,
  endAdornment,
  className = "",
  ...props
}: TextFieldProps) {
  return (
    <div className="relative">
      {startAdornment && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
          {startAdornment}
        </div>
      )}

      <input
        className={`
          border rounded-md py-2 px-3 w-full
          ${startAdornment ? "pl-10" : ""}
          ${endAdornment ? "pr-10" : ""}
          ${className}
        `}
        {...props}
      />

      {endAdornment && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {endAdornment}
        </div>
      )}
    </div>
  );
}
