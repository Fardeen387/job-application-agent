import fitz  # PyMuPDF
from fastapi import UploadFile
import io

class PDFParserService:
    @staticmethod
    async def extract_text(file: UploadFile) -> str:
        """
        Reads an uploaded PDF file and extracts raw text.
        """
        try:
            # Read file into memory
            file_content = await file.read()
            # Open PDF with PyMuPDF
            doc = fitz.open(stream=file_content, filetype="pdf")
            
            full_text = ""
            for page in doc:
                full_text += page.get_text()
            
            doc.close()
            return full_text.strip()
        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")

    @staticmethod
    def clean_text(text: str) -> str:
        """
        Basic cleaning to remove extra whitespaces or weird characters 
        that can confuse embeddings.
        """
        # Replace multiple spaces/newlines with single ones
        import re
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
