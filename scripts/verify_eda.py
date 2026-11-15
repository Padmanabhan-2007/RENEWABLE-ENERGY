import pandas as pd
import numpy as np

df = pd.read_csv("data/Database.csv")
print("Original shape:", df.shape)
print("Columns:", df.columns.tolist())
print("\nFirst 3 rows:")
print(df.head(3))

# Check export index
if "Unnamed: 0" in df.columns:
    print("Found export index column 'Unnamed: 0', dropping it.")
    df = df.drop(columns=["Unnamed: 0"])

# Negative counts
neg_pv = (df["PV_production"] < 0).sum()
neg_wind = (df["Wind_production"] < 0).sum()
print(f"\nNegative PV readings: {neg_pv} (Expected ~112,829)")
print(f"Negative Wind readings: {neg_wind} (Expected ~216)")

# Missing values
print("\nMissing values per column:")
print(df.isnull().sum())

# Timestamp parsing
print("\nSample timestamps:", df["Time"].head(3).tolist())
df["Timestamp"] = pd.to_datetime(df["Time"])
time_diffs = df["Timestamp"].diff().value_counts()
print("\nTimestamp cadence diffs:")
print(time_diffs.head(5))

# Date range
print(f"Date range: {df['Timestamp'].min()} to {df['Timestamp'].max()}")

# Set negative to 0
df["PV_production"] = df["PV_production"].clip(lower=0)
df["Wind_production"] = df["Wind_production"].clip(lower=0)

# Resample to hourly means
# Group by hourly floor or resample
df_hourly = df.set_index("Timestamp").resample("1h").agg({
    "DHI": "mean",
    "DNI": "mean",
    "GHI": "mean",
    "Wind_speed": "mean",
    "Humidity": "mean",
    "Temperature": "mean",
    "PV_production": "mean",
    "Wind_production": "mean",
    "Electric_demand": "mean",
    "Season": "first",
    "Day_of_the_week": "first"
}).reset_index()

print("\nHourly shape:", df_hourly.shape)
print(f"Hourly date range: {df_hourly['Timestamp'].min()} to {df_hourly['Timestamp'].max()}")

n_rows = len(df_hourly)
n_train = int(n_rows * 0.70)
n_val = int(n_rows * 0.15)
n_test = n_rows - n_train - n_val
print(f"Split counts: Train={n_train}, Val={n_val}, Test={n_test} (Sum = {n_train + n_val + n_test})")

