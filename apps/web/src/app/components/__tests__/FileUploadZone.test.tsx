import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileUploadZone from '../FileUploadZone';

describe('FileUploadZone', () => {
  it('renders dropzone with default text', () => {
    render(<FileUploadZone />);
    expect(screen.getByText('Drag and drop file here')).toBeInTheDocument();
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
  });

  it('displays file size and type restrictions', () => {
    render(<FileUploadZone maxSizeMB={10} />);
    expect(screen.getByText(/Max size: 10MB/i)).toBeInTheDocument();
    expect(screen.getByText(/Accepted: JPG, PNG, WEBP, PDF/i)).toBeInTheDocument();
  });

  it('shows placeholder notice', () => {
    render(<FileUploadZone />);
    expect(screen.getByText(/This is a placeholder component/i)).toBeInTheDocument();
  });

  it('validates file type correctly', async () => {
    const onFileSelect = jest.fn();
    render(<FileUploadZone onFileSelect={onFileSelect} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create invalid file (text/plain)
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('validates file size correctly', async () => {
    const onFileSelect = jest.fn();
    render(<FileUploadZone onFileSelect={onFileSelect} maxSizeMB={1} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create oversized file (2MB)
    const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
    const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds 1MB limit/i)).toBeInTheDocument();
    });
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('accepts valid file and shows preview', async () => {
    const onFileSelect = jest.fn();
    render(<FileUploadZone onFileSelect={onFileSelect} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
      expect(screen.getByText('Upload Document')).toBeInTheDocument();
    });
    expect(onFileSelect).toHaveBeenCalledWith(validFile);
  });

  it('shows file size correctly for small files', async () => {
    render(<FileUploadZone />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const smallFile = new File(['x'.repeat(500)], 'small.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(input, { target: { files: [smallFile] } });

    await waitFor(() => {
      expect(screen.getByText('500 B')).toBeInTheDocument();
    });
  });

  it('removes file when remove button is clicked', async () => {
    render(<FileUploadZone />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });

    const removeButton = screen.getByTitle('Remove file');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('test.jpg')).not.toBeInTheDocument();
      expect(screen.getByText('Drag and drop file here')).toBeInTheDocument();
    });
  });

  it('simulates upload progress when upload button is clicked', async () => {
    render(<FileUploadZone />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText('Upload Document')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('Upload Document');
    fireEvent.click(uploadButton);

    // Wait for uploading state
    await waitFor(() => {
      expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
    });

    // Wait for completion - component resets to dropzone after upload succeeds
    await waitFor(() => {
      expect(screen.getByText('Drag and drop file here')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('disables interactions when disabled prop is true', () => {
    render(<FileUploadZone disabled={true} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('shows correct icon for PDF files', async () => {
    render(<FileUploadZone />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    
    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('📄')).toBeInTheDocument();
    });
  });

  it('shows correct icon for image files', async () => {
    render(<FileUploadZone />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imageFile = new File(['content'], 'photo.png', { type: 'image/png' });
    
    fireEvent.change(input, { target: { files: [imageFile] } });

    await waitFor(() => {
      expect(screen.getByText('photo.png')).toBeInTheDocument();
      expect(screen.getByText('🖼️')).toBeInTheDocument();
    });
  });
});
