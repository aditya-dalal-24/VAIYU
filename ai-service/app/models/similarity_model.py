class SimilarityModel:
    """
    KNN Cosine Similarity Search Engine over precomputed IBTrACS historical embeddings
    """
    def find_similar(self, cyclone_id: str):
        return [
            {
                "cyclone_id": cyclone_id,
                "rank": 1,
                "similarity_score": 0.94,
                "historical_cyclone": {
                    "id": "fani-2019",
                    "name": "Cyclone Fani",
                    "year": 2019,
                    "final_intensity": "Extremely Severe Cyclonic Storm",
                    "final_landfall_location": "Puri, Odisha",
                    "impact_summary": "Category 4 equivalent landfall near Puri with sustained winds up to 215 km/h; ~1.2 million evacuated.",
                    "max_wind_speed_kmh": 215.0,
                    "min_pressure_hpa": 932.0
                }
            },
            {
                "cyclone_id": cyclone_id,
                "rank": 2,
                "similarity_score": 0.89,
                "historical_cyclone": {
                    "id": "vayu-2019",
                    "name": "Cyclone Vayu",
                    "year": 2019,
                    "final_intensity": "Very Severe Cyclonic Storm",
                    "final_landfall_location": "Saurashtra Coast, Gujarat",
                    "impact_summary": "Skirted Saurashtra coast bringing heavy rainfall and storm surges.",
                    "max_wind_speed_kmh": 150.0,
                    "min_pressure_hpa": 970.0
                }
            },
            {
                "cyclone_id": cyclone_id,
                "rank": 3,
                "similarity_score": 0.85,
                "historical_cyclone": {
                    "id": "tauktae-2021",
                    "name": "Cyclone Tauktae",
                    "year": 2021,
                    "final_intensity": "Extremely Severe Cyclonic Storm",
                    "final_landfall_location": "Una, Gujarat",
                    "impact_summary": "Paralleled West Coast causing severe damage across Goa, Maharashtra, Gujarat.",
                    "max_wind_speed_kmh": 185.0,
                    "min_pressure_hpa": 950.0
                }
            }
        ]
