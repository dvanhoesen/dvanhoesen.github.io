# Use PyTrends to get most relevant Google Searchs
# Update html with headers of relevant google search terms
# Push to GitHub


from pytrends.request import TrendReq
from definitions import *
import os
import pandas as pd


#print(PROJECT_DIR)
#print(BASE_DIR)


github_token_path = BASE_DIR + os.path.sep + "Desktop" + os.path.sep + "github_token.txt"

file = open(github_token_path, "r")
file_info = file.read()
file_info = file_info.split("\n")
github_username = file_info[0]
github_token = file_info[1]


print(github_username)
print(github_token)

# Connect to Google
pytrends = TrendReq(hl='en-US', tz=360)

# Build the search
keyword_list = ["politics", "weather", "stock", "market", "sports"]
pytrends.build_payload(keyword_list, cat=0, timeframe='today 5-y', geo='', gprop='')

df = pytrends.interest_over_time()

print(df.head())