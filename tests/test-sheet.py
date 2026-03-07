import os
import sys
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

def main():
    # Parse env file manually
    env = {}
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, "../.env.local")
    with open(env_path) as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                env[k] = v.strip('"\'')

    creds_info = {
        "type": "service_account",
        "client_email": env["GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL"],
        "private_key": env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"].replace('\\n', '\n'),
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    
    creds = service_account.Credentials.from_service_account_info(
        creds_info, scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()
    
    SPREADSHEET_ID = env["GOOGLE_SHEETS_DIRECTORY_ID"]
    
    # Try getting news 
    try:
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range='News').execute()
        print("News Tab contents:")
        print(json.dumps(result.get('values', []), indent=2))
    except Exception as e:
        print(e)
        
if __name__ == '__main__':
    main()
