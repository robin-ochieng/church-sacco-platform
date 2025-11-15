'use client';

import { useCallback, useState } from 'react';

interface FileDropzoneProps {
  label: string;
  accept?: string;
  maxSize?: number; // in MB
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  uploadedFile?: {
    name: string;
    url?: string;
  } | null;
  error?: string | null;
  required?: boolean;
}

export function FileDropzone({
  label,
  accept = 'image/jpeg,image/png,image/jpg,application/pdf',
  maxSize = 10,
  onFileSelect,
  uploading = false,
  uploadedFile = null,
  error = null,
  required = false,
}: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Generate unique ID for accessibility
  const inputId = `file-input-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        alert(`File size exceeds ${maxSize}MB limit`);
        return;
      }

      // Validate file type
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      if (!acceptedTypes.includes(file.type)) {
        alert(`File type not accepted. Please upload: ${accept}`);
        return;
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }

      onFileSelect(file);
    },
    [accept, maxSize, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        validateAndSelectFile(e.dataTransfer.files[0]);
      }
    },
    [validateAndSelectFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files && e.target.files[0]) {
        validateAndSelectFile(e.target.files[0]);
      }
    },
    [validateAndSelectFile],
  );

  const handleRemove = useCallback(() => {
    setPreview(null);
  }, []);

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Show uploaded file or preview */}
      {(uploadedFile || preview) && !uploading && (
        <div className="relative border-2 border-green-300 rounded-lg p-4 bg-green-50">
          {preview && (
            <div className="mb-2">
              <img
                src={preview}
                alt="Preview"
                className="max-h-32 rounded object-contain mx-auto"
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-700">
              <svg
                className="w-5 h-5 text-green-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium">
                {uploadedFile?.name || 'File uploaded successfully'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      {!uploadedFile && !preview && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-gray-50'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            id={inputId}
            type="file"
            accept={accept}
            onChange={handleChange}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label={label}
          />

          <div className="text-center">
            {uploading ? (
              <>
                <svg
                  className="animate-spin mx-auto h-12 w-12 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="mt-2 text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold text-blue-600">Click to upload</span> or
                  drag and drop
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  PNG, JPG, PDF up to {maxSize}MB
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <svg
            className="w-4 h-4 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
