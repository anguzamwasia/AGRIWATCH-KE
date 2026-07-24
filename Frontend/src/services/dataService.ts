// Backend data service for agricultural predictions
export interface MonthlyData {
  month: string;
  rainfall: number;
  temperature: number;
  humidity: number;
  sunshine: number;
  yield: number;
  ndvi: number;
  evi: number;
  rvi: number;
  chirps_rainfall: number;
  soil_moisture: number;
  soil_temp: number;
  soil_organic: number;
  modis_temp: number;
}

export interface YearlyData {
  year: number;
  yield: number;
  rainfall: number;
  temperature: number;
}

export interface PredictionParams {
  county: string;
  subcounty?: string;
  year: number;
  crop: string;
}

class DataService {
  private baseUrl = '/api'; // This would be your actual API endpoint

  // Simulate API call for monthly data
  async getMonthlyData(params: PredictionParams): Promise<MonthlyData[]> {
    // In a real implementation, this would make an HTTP request
    // For now, we'll generate realistic data based on the parameters
    
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Generate county-specific base values
    const countyFactors = this.getCountyFactors(params.county);
    const cropFactors = this.getCropFactors(params.crop);
    const yearFactors = this.getYearFactors(params.year);

    return months.map((month, index) => {
      const seasonality = this.getSeasonalityFactor(index);
      
      return {
        month,
        rainfall: Math.max(0, countyFactors.rainfall * seasonality.rainfall * (1 + (Math.random() - 0.5) * 0.3)),
        temperature: countyFactors.temperature + seasonality.temperature + (Math.random() - 0.5) * 3,
        humidity: Math.max(30, Math.min(90, countyFactors.humidity + seasonality.humidity + (Math.random() - 0.5) * 10)),
        sunshine: Math.max(2, Math.min(12, countyFactors.sunshine * seasonality.sunshine * (1 + (Math.random() - 0.5) * 0.2))),
        yield: Math.max(0.1, cropFactors.baseYield * seasonality.growthFactor * yearFactors.yield * (1 + (Math.random() - 0.5) * 0.4)),
        ndvi: Math.max(0.1, Math.min(0.9, cropFactors.ndvi * seasonality.vegetation * (1 + (Math.random() - 0.5) * 0.3))),
        evi: Math.max(0.05, Math.min(0.7, cropFactors.evi * seasonality.vegetation * (1 + (Math.random() - 0.5) * 0.3))),
        rvi: Math.max(1, Math.min(12, cropFactors.rvi * seasonality.vegetation * (1 + (Math.random() - 0.5) * 0.4))),
        chirps_rainfall: Math.max(0, countyFactors.rainfall * seasonality.rainfall * (1 + (Math.random() - 0.5) * 0.25)),
        soil_moisture: Math.max(10, Math.min(50, countyFactors.soilMoisture * seasonality.moisture * (1 + (Math.random() - 0.5) * 0.3))),
        soil_temp: countyFactors.soilTemp + seasonality.temperature * 0.8 + (Math.random() - 0.5) * 2,
        soil_organic: Math.max(0.5, Math.min(5, countyFactors.organicContent * (1 + (Math.random() - 0.5) * 0.2))),
        modis_temp: countyFactors.temperature + seasonality.temperature + (Math.random() - 0.5) * 2
      };
    });
  }

  // Simulate API call for yearly trend data
  async getYearlyTrend(params: PredictionParams): Promise<YearlyData[]> {
    const years = Array.from({ length: 9 }, (_, i) => 2017 + i); // 2017-2025
    const countyFactors = this.getCountyFactors(params.county);
    const cropFactors = this.getCropFactors(params.crop);

    return years.map(year => {
      const yearFactors = this.getYearFactors(year);
      const climateChange = (year - 2017) * 0.02; // Small climate change factor
      
      return {
        year,
        yield: Math.max(0.5, cropFactors.baseYield * yearFactors.yield * (1 + (Math.random() - 0.5) * 0.3)),
        rainfall: Math.max(200, countyFactors.rainfall * (1 - climateChange * 0.5) * (1 + (Math.random() - 0.5) * 0.2)),
        temperature: countyFactors.temperature + climateChange * 15 + (Math.random() - 0.5) * 2
      };
    });
  }

  // Get county-specific base factors
  private getCountyFactors(county: string) {
    const factors: { [key: string]: any } = {
      'Nairobi': { rainfall: 850, temperature: 24, humidity: 70, sunshine: 7, soilMoisture: 25, soilTemp: 22, organicContent: 2.1 },
      'Mombasa': { rainfall: 1100, temperature: 28, humidity: 80, sunshine: 8, soilMoisture: 30, soilTemp: 26, organicContent: 1.8 },
      'Nakuru': { rainfall: 950, temperature: 22, humidity: 65, sunshine: 8, soilMoisture: 35, soilTemp: 20, organicContent: 2.8 },
      'Meru': { rainfall: 1200, temperature: 20, humidity: 75, sunshine: 7, soilMoisture: 40, soilTemp: 18, organicContent: 3.2 },
      'Kisumu': { rainfall: 1300, temperature: 26, humidity: 75, sunshine: 7, soilMoisture: 35, soilTemp: 24, organicContent: 2.5 },
      'Turkana': { rainfall: 200, temperature: 32, humidity: 40, sunshine: 10, soilMoisture: 15, soilTemp: 30, organicContent: 0.8 },
      'Nyeri': { rainfall: 1400, temperature: 18, humidity: 80, sunshine: 6, soilMoisture: 45, soilTemp: 16, organicContent: 3.5 }
    };

    return factors[county] || { rainfall: 800, temperature: 24, humidity: 65, sunshine: 7, soilMoisture: 30, soilTemp: 22, organicContent: 2.0 };
  }

  // Get crop-specific factors
  private getCropFactors(crop: string) {
    const factors: { [key: string]: any } = {
      'Maize': { baseYield: 2.5, ndvi: 0.6, evi: 0.4, rvi: 6 },
      'Wheat': { baseYield: 3.2, ndvi: 0.7, evi: 0.5, rvi: 7 },
      'Rice': { baseYield: 4.1, ndvi: 0.8, evi: 0.6, rvi: 8 },
      'Beans': { baseYield: 1.8, ndvi: 0.5, evi: 0.3, rvi: 4 },
      'Coffee': { baseYield: 1.2, ndvi: 0.7, evi: 0.5, rvi: 6 },
      'Tea': { baseYield: 2.8, ndvi: 0.8, evi: 0.6, rvi: 7 },
      'Sugarcane': { baseYield: 65, ndvi: 0.9, evi: 0.7, rvi: 9 }
    };

    return factors[crop] || { baseYield: 2.0, ndvi: 0.6, evi: 0.4, rvi: 5 };
  }

  // Get year-specific factors (climate variability, El Niño, etc.)
  private getYearFactors(year: number) {
    const yearEffects: { [key: number]: any } = {
      2017: { yield: 0.9 }, // Drought year
      2018: { yield: 1.1 }, // Good rains
      2019: { yield: 0.8 }, // Locust invasion
      2020: { yield: 1.0 }, // Average
      2021: { yield: 0.95 }, // COVID effects
      2022: { yield: 0.85 }, // Drought
      2023: { yield: 1.05 }, // Recovery
      2024: { yield: 1.0 }, // Average
      2025: { yield: 1.02 } // Predicted slight improvement
    };

    return yearEffects[year] || { yield: 1.0 };
  }

  // Get seasonality factors for Kenya
  private getSeasonalityFactor(monthIndex: number) {
    // Kenya has two rainy seasons: Long rains (Mar-May) and Short rains (Oct-Dec)
    const longRains = monthIndex >= 2 && monthIndex <= 4; // Mar-May
    const shortRains = monthIndex >= 9 && monthIndex <= 11; // Oct-Dec
    const drySeasons = !longRains && !shortRains;

    return {
      rainfall: longRains ? 2.5 : shortRains ? 1.8 : 0.3,
      temperature: monthIndex >= 5 && monthIndex <= 8 ? 0.8 : 1.0, // Cooler during dry season
      humidity: longRains ? 1.3 : shortRains ? 1.1 : 0.7,
      sunshine: drySeasons ? 1.2 : longRains ? 0.6 : 0.8,
      vegetation: longRains ? 1.4 : shortRains ? 1.1 : monthIndex >= 6 && monthIndex <= 8 ? 0.6 : 0.8,
      growthFactor: longRains ? 1.5 : shortRains ? 1.2 : 0.4,
      moisture: longRains ? 1.6 : shortRains ? 1.3 : 0.5
    };
  }

  // Get key metrics summary
  async getKeyMetrics(params: PredictionParams) {
    const monthlyData = await this.getMonthlyData(params);
    const yearlyData = await this.getYearlyTrend(params);
    
    const currentYearData = yearlyData.find(d => d.year === params.year);
    const avgYield = monthlyData.reduce((sum, item) => sum + item.yield, 0) / 12;
    const totalRainfall = monthlyData.reduce((sum, item) => sum + item.rainfall, 0);
    const avgTemperature = monthlyData.reduce((sum, item) => sum + item.temperature, 0) / 12;
    const sunshineHours = monthlyData.reduce((sum, item) => sum + item.sunshine, 0) * 30; // Convert to monthly hours

    return {
      predictedYield: currentYearData?.yield || avgYield,
      annualRainfall: totalRainfall,
      avgTemperature,
      sunshineHours,
      riskLevel: this.calculateRiskLevel(params, monthlyData),
      confidence: this.calculateConfidence(params, monthlyData)
    };
  }

  private calculateRiskLevel(params: PredictionParams, data: MonthlyData[]) {
    const avgRainfall = data.reduce((sum, item) => sum + item.rainfall, 0) / 12;
    const avgTemp = data.reduce((sum, item) => sum + item.temperature, 0) / 12;
    
    if (avgRainfall < 50 || avgTemp > 35) return 'High';
    if (avgRainfall < 80 || avgTemp > 30) return 'Medium';
    return 'Low';
  }

  private calculateConfidence(params: PredictionParams, data: MonthlyData[]) {
    // Base confidence on data availability and historical accuracy
    const baseConfidence = 75;
    const recentYearBonus = params.year >= 2020 ? 10 : 0;
    const dataQualityBonus = Math.random() * 10; // Simulate data quality variance
    
    return Math.min(95, baseConfidence + recentYearBonus + dataQualityBonus);
  }
}

export const dataService = new DataService();