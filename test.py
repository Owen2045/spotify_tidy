from main import ensure_spotify



def test_genres():
    """
    用藝人找曲風
    """
    sp = ensure_spotify()
    
    track_id = "48N4QmxXPEzt3J9nDMaGP0"  # 你的曲目 ID
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
    print(track_genres)

