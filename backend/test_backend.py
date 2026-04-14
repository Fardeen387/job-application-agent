import asyncio
import httpx
import json

async def test_optimization():
    url = "http://localhost:8000/optimize"
    
    print("🚀 Connecting to server...")
    
    try:
        resume_file_obj = open("test.pdf", "rb")
        files = {
            "resume_file": ("test.pdf", resume_file_obj, "application/pdf")
        }
        data = {
            "jd_text": "Software Engineer with Python and FastAPI experience"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, data=data, files=files) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    print(f"❌ Server Error: {response.status_code} - {error_text.decode()}")
                    return

                async for line in response.aiter_lines():
                    if not line.strip() or not line.startswith("data: "):
                        continue
                        
                    try:
                        # Extract the JSON string after 'data: '
                        raw_data = line[6:].strip()
                        event = json.loads(raw_data)
                        
                        # Fix: LangGraph sometimes sends a list [mode, data] 
                        # or a dict {"mode": data}. We handle both.
                        
                        content = {}
                        mode = ""

                        if isinstance(event, list) and len(event) >= 2:
                            mode = event[0]
                            content = event[1]
                        elif isinstance(event, dict):
                            if "custom" in event:
                                mode = "custom"
                                content = event["custom"]
                            elif "updates" in event:
                                mode = "updates"
                                content = event["updates"]

                        # 1. Handle "Custom" Thinking Messages
                        if mode == "custom":
                            status = content.get("status", "Processing...")
                            print(f"🧠 [THINKING]: {status}")
                        
                        # 2. Handle "Updates" (Node Results)
                        elif mode == "updates":
                            # content is a dict where keys are node names
                            for node_name, node_data in content.items():
                                print(f"✅ [NODE COMPLETED]: {node_name}")
                                
                                if isinstance(node_data, dict):
                                    if "latest_final_score" in node_data:
                                        print(f"📊 MATCH SCORE: {node_data['latest_final_score']}%")
                                    if "current_resume_content" in node_data:
                                        print("📝 Resume Content Updated!")

                    except json.JSONDecodeError:
                        continue 
                    except Exception as e:
                        # Print the raw event to debug if parsing still fails
                        print(f"⚠️ Parsing quirk: {e} | Raw: {line[:100]}")

    except FileNotFoundError:
        print("❌ Error: 'test.pdf' not found.")
    except Exception as e:
        print(f"❌ Test Failed: {e}")
    finally:
        if 'resume_file_obj' in locals():
            resume_file_obj.close()

if __name__ == "__main__":
    asyncio.run(test_optimization())