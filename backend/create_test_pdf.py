import fitz # PyMuPDF
doc = fitz.open()
page = doc.new_page()
page.insert_text((50, 50), "I am a computer science student skilled in Python and web development.")
doc.save("test.pdf")
doc.close()
print("test.pdf created!")