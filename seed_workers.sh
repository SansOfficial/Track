#!/bin/bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjU0NTUxMDgsInJvbGUiOiJhZG1pbiIsInN1YiI6MSwidXNlcm5hbWUiOiJhZG1pbiJ9.13xNBdYoPKqeCpRxB9VnkxTkIsVJuvKSUhosB1nPoOg"

# 1. 下料 (XL)
curl -X POST http://localhost:8080/api/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sim_Xialiao", "station": "下料", "phone": "1001"}'

# 2. 裁面 (CM)
curl -X POST http://localhost:8080/api/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sim_Caimian", "station": "裁面", "phone": "1002"}'

# 3. 封面 (FM)
curl -X POST http://localhost:8080/api/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sim_Fengmian", "station": "封面", "phone": "1003"}'

# 4. 送货 (YH) - Using "送货" to match backend expectation
curl -X POST http://localhost:8080/api/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sim_Songhuo", "station": "送货", "phone": "1004"}'

# 5. 收款 (SK)
curl -X POST http://localhost:8080/api/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sim_Shoukuan", "station": "收款", "phone": "1005"}'
