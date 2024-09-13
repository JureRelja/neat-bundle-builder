export interface FileStoreService {
    uploadFile(fileName: string, files: File | File[]): Promise<string>;

    getFile(fileUrl: string): Promise<File | null>;

    deleteFile(fileUrl: string): boolean;
}
