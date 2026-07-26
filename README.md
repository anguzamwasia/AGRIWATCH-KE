# AgriWatch KE 🌍🌾
### GeoAI Food Security Early Warning System

**AgriWatch KE** is an AI-powered, satellite-driven agricultural decision-support dashboard designed to predict crop yields and monitor food security risks months before harvest across Kenya's 47 counties. By translating remote sensing climate data into early warning metrics, the platform shifts humanitarian planning and policy decisions from reactive relief to **anticipatory action**.

---

## 🚀 Key Features

*   **GeoAI Yield Surface Map:** Renders high-resolution (0.1 km) spatial yield estimation overlays for four major staple crops: **Maize, Wheat, Potatoes, and Pigeonpeas**.
*   **Automatic Alert HUD:** Computes county and subcounty yield deviations from long-term baseline statistics, triggering status warning codes:
    *   🟢 **Normal (Green):** Within 10% of baseline.
    *   🟡 **Watch (Orange):** 10% to 30% below baseline (resource pre-positioning recommended).
    *   🔴 **Alarm (Red):** More than 30% below baseline (immediate anticipatory relief protocol activated).
*   **Climate Predictor Analytics:** Provides interactive visualizations of monthly remote sensing variables including NDVI (vegetation health), Land Surface Temperature (LST), CHIRPS rainfall, and soil moisture.
*   **Real-Time Phenology Tracking:** Incorporates Sentinel-2 satellite data to plot real-time crop growth curves, bridging the temporal lag of seasonal sensors.
*   **AI Database Advisor:** An embedded, context-grounded chatbot powered by the **Google Gemini API** that answers natural language questions about crop metrics, rankings, and climate anomalies.
*   **PDF Report Compiler:** Compiles dynamic summaries, environmental variables, and advisory bulletins into high-resolution multi-page PDF documents for download.

---

## 🛠️ Technology Stack

*   **Frontend:** React, TypeScript, Vite, TailwindCSS, Leaflet.js
*   **Backend:** FastAPI (Python), XGBoost, Rasterio, GeoPandas, Pandas, NumPy
*   **Remote Sensing Core:** Google Earth Engine (GEE) API
*   **Database:** PostgreSQL (Supabase)
*   **AI Model:** Google Gemini API (`gemini-flash-latest`)

---

## 📐 Machine Learning & Prediction Logic

The core regression model estimates county-level crop yields $\hat{y}$ using a gradient-boosted decision tree architecture (**XGBoost**):

$$\hat{y} = \sum_{k=1}^{K} f_k(X)$$

Where the input feature vector $X$ consists of:
1.  **NDVI (MODIS MOD13Q1):** Vegetation canopy vigor.
2.  **Land Surface Temperature (MODIS MOD11A2):** Heat stress indicator.
3.  **CHIRPS Precipitation:** Accumulated daily rainfall.
4.  **TerraClimate Soil Moisture:** Crop-available water content.

### Yield Deviation Formula
To calculate early alerts, the platform evaluates the percentage change against historical baseline averages:

$$\Delta Y = \left( \frac{Y_{pred} - Y_{base}}{Y_{base}} \right) \times 100\%$$

---

## ⚙️ Local Development & Setup

Follow these steps to run the complete stack locally:

### Prerequisites
*   Node.js (v18+)
*   Python (v3.10+)
*   Google Earth Engine service account credentials (stored as a JSON key)

---

### 1. Backend Setup (FastAPI)

1.  Navigate to the `Backend` directory:
    ```bash
    cd Backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: .\venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create a `.env` file in the `Backend` directory and define your keys:
    ```env
    # Database Configuration
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_KEY=your_supabase_secret_key

    # Google Earth Engine Credentials
    GEE_PROJECT=your_earth_engine_project_name
    GEE_SERVICE_ACCOUNT=your_service_account_email@your_project.iam.gserviceaccount.com
    GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

    # Gemini AI Configuration
    GEMINI_API_KEY=your_google_gemini_api_key
    ```
5.  Start the backend API server:
    ```bash
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
    ```

---

### 2. Frontend Setup (React)

1.  Navigate to the `Frontend` directory:
    ```bash
    cd ../Frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the `Frontend` directory:
    ```env
    VITE_API_URL=http://127.0.0.1:8000
    VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
    ```
4.  Launch the development server:
    ```bash
    npm run dev
    ```

---

## 📁 Repository Structure

```text
├── Backend/
│   ├── data/                 # Spatial geometries and baseline datasets
│   ├── models/               # XGBoost model training and saved weights
│   ├── main.py               # FastAPI application endpoints
│   ├── map_service.py        # Geospatial clipping and raster rendering
│   └── ee_service.py         # Google Earth Engine remote sensing client
├── Frontend/
│   ├── src/
│   │   ├── components/       # Map, chart, report, and chatbot UI components
│   │   ├── pages/            # Core dashboard layout views
│   │   └── data/             # Static crop metadata and boundary settings
│   └── package.json
└── render.yaml               # Infrastructure configuration for deployment
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
