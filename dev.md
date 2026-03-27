> **日常維運提醒**：
> * 重新啟動後端
sudo docker-compose -f compose.dev.yml restart backend
> * 查看後端系統日誌
sudo docker-compose -f compose.dev.yml logs -f backend
> * 測試腳本
sudo docker exec -it spotify_backend_dev python test.py