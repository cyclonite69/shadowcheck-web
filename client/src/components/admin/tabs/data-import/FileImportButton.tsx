import React from 'react';

interface FileImportButtonProps {
  id: string;
  accept: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  isLoading: boolean;
  loadingText: string;
  idleText: string;
  activeColorClass: string;
  multiple?: boolean;
  directory?: boolean;
}

type DirectoryInputProps = {
  directory?: string;
  webkitdirectory?: string;
};

export const FileImportButton: React.FC<FileImportButtonProps> = ({
  id,
  accept,
  onChange,
  disabled,
  isLoading,
  loadingText,
  idleText,
  activeColorClass,
  multiple = false,
  directory = false,
}) => (
  <div className="block">
    <input
      id={id}
      type="file"
      accept={accept}
      onChange={onChange}
      disabled={disabled}
      multiple={multiple}
      className="hidden"
      {...(directory
        ? ({ webkitdirectory: 'true', directory: 'true' } as DirectoryInputProps)
        : {})}
    />
    <label
      htmlFor={id}
      className={`px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-all text-white bg-gradient-to-r ${activeColorClass} ${
        !disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
      }`}
    >
      {isLoading ? loadingText : idleText}
    </label>
  </div>
);
