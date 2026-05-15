#!/usr/bin/env python3
"""
Inspect skeleton and animation details of a GLB file.
"""

import struct
import json
from pathlib import Path
import sys

def inspect_skeleton(filepath):
    with open(filepath, 'rb') as f:
        f.read(12)  # skip header
        json_chunk_length = struct.unpack('<I', f.read(4))[0]
        f.read(4)  # chunk type
        json_data = f.read(json_chunk_length).decode('utf-8')
        gltf = json.loads(json_data)

    print("=" * 60)
    print("🦴 SKELETON & ANIMATION DETAILS")
    print("=" * 60)

    # Skins
    skins = gltf.get('skins', [])
    print(f"\n🦴 SKINS: {len(skins)}")
    for i, skin in enumerate(skins):
        joints = skin.get('joints', [])
        print(f"\n  Skin {i}: {skin.get('name', 'unnamed')}")
        print(f"  Joint count: {len(joints)}")
        nodes = gltf.get('nodes', [])
        print(f"  Bones:")
        for j_idx in joints:
            node = nodes[j_idx]
            print(f"    [{j_idx}] {node.get('name', 'unnamed')}")

    # Animations
    animations = gltf.get('animations', [])
    print(f"\n🎬 ANIMATIONS: {len(animations)}")
    for i, anim in enumerate(animations):
        channels = anim.get('channels', [])
        samplers = anim.get('samplers', [])
        print(f"\n  Animation {i}: '{anim.get('name', 'unnamed')}'")
        print(f"  Channels: {len(channels)}")
        print(f"  Samplers: {len(samplers)}")

        # Get duration from accessor
        if samplers:
            input_accessor_idx = samplers[0].get('input')
            if input_accessor_idx is not None:
                accessor = gltf['accessors'][input_accessor_idx]
                duration = accessor.get('max', [0])[0] if accessor.get('max') else '?'
                print(f"  Duration: {duration}s")

        # What bones are animated
        animated_bones = set()
        nodes = gltf.get('nodes', [])
        for ch in channels:
            target = ch.get('target', {})
            node_idx = target.get('node')
            path = target.get('path')
            if node_idx is not None:
                name = nodes[node_idx].get('name', f'node_{node_idx}')
                animated_bones.add(f"{name} ({path})")
        print(f"  Animated targets ({len(animated_bones)}):")
        for b in sorted(animated_bones):
            print(f"    • {b}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_skeleton.py <file.glb>")
        sys.exit(1)
    inspect_skeleton(sys.argv[1])
