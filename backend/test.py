from main import ensure_spotify



def test_genres():
    """
    用藝人找曲風
    """
    sp = ensure_spotify()
    
    track_id = "7GQ41QhQcT9QhzbcZl6POY"  # 你的曲目 ID
    track = sp.track(track_id)
    print('track')
    print(track)
    
    artist_ids = [a["id"] for a in track["artists"]]
    print('artist_ids')
    print(artist_ids)

    artists = sp.artists(artist_ids)["artists"]

    print('artists')
    print(artists)
        
    track_genres = sorted({g for ar in artists for g in ar.get("genres", [])})
    print("曲風分析結果:", track_genres)

if __name__ == "__main__":
    test_genres()
