import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FileType2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const CsvImport: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are allowed');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    const loadingToast = toast.loading('Importing leads in background...');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      await axios.post(`${apiUrl}/protected/leads/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
      });
      toast.success('Leads imported successfully!', { id: loadingToast });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.error || 'Failed to import leads', { id: loadingToast });
      } else {
        toast.error('An unexpected error occurred', { id: loadingToast });
      }
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col justify-center pb-20">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Data Ingestion</h1>
        <p className="text-gray-400">Upload your scraped CSV files to populate the Lead Kanban.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full h-80 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center bg-glass backdrop-blur-xl ${
          isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-gray-700 hover:border-gray-500 hover:bg-white/5'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={onFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center text-blue-400">
            <svg className="animate-spin h-12 w-12 border-t-2 border-b-2 border-blue-500 rounded-full mb-4" viewBox="0 0 24 24"></svg>
            <p className="font-medium text-lg">Processing CSV Data...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-400 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/50 border border-gray-800 flex items-center justify-center mb-6 shadow-2xl">
              <UploadCloud size={36} className="text-blue-400" />
            </div>
            <p className="text-2xl font-semibold text-white mb-2">Drag & Drop your CSV here</p>
            <p className="text-sm">or click to browse from your computer</p>
            
            <div className="mt-8 flex items-center gap-2 text-xs text-gray-500 bg-black/40 px-4 py-2 rounded-full border border-gray-800">
              <FileType2 size={14} />
              <span>Supports only standard .csv format</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CsvImport;
