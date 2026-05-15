#!/usr/bin/env python3
"""
GLB Mesh Analyzer
Analyzes the complexity and structure of a GLB file to determine rigging feasibility.
"""

import struct
import json
import base64
from pathlib import Path


def analyze_glb(filepath):
    """Analyze a GLB file and extract mesh statistics."""
    
    with open(filepath, 'rb') as f:
        # Read GLB header
        magic = f.read(4)
        if magic != b'glTF':
            print("❌ Not a valid GLB file!")
            return
        
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        
        print("=" * 60)
        print("📊 GLB FILE ANALYSIS")
        print("=" * 60)
        print(f"File: {Path(filepath).name}")
        print(f"Size: {length / (1024*1024):.2f} MB")
        print(f"glTF Version: {version}")
        print()
        
        # Read JSON chunk
        json_chunk_length = struct.unpack('<I', f.read(4))[0]
        json_chunk_type = f.read(4)
        json_data = f.read(json_chunk_length).decode('utf-8')
        gltf = json.loads(json_data)
        
        # Analyze structure
        print("📦 STRUCTURE:")
        print(f"  Scenes: {len(gltf.get('scenes', []))}")
        print(f"  Nodes: {len(gltf.get('nodes', []))}")
        print(f"  Meshes: {len(gltf.get('meshes', []))}")
        print(f"  Materials: {len(gltf.get('materials', []))}")
        print(f"  Textures: {len(gltf.get('textures', []))}")
        print(f"  Images: {len(gltf.get('images', []))}")
        print(f"  Accessors: {len(gltf.get('accessors', []))}")
        print(f"  BufferViews: {len(gltf.get('bufferViews', []))}")
        print()
        
        # Check for existing rig
        has_skin = 'skins' in gltf and len(gltf['skins']) > 0
        has_animations = 'animations' in gltf and len(gltf['animations']) > 0
        
        print("🦴 RIGGING STATUS:")
        print(f"  Has Skeleton: {'✅ Yes' if has_skin else '❌ No'}")
        print(f"  Has Animations: {'✅ Yes' if has_animations else '❌ No'}")
        print()
        
        # Analyze meshes
        if 'meshes' in gltf:
            print("🔺 MESH DETAILS:")
            total_vertices = 0
            total_triangles = 0
            
            for i, mesh in enumerate(gltf['meshes']):
                mesh_name = mesh.get('name', f'Mesh_{i}')
                print(f"\n  Mesh {i}: {mesh_name}")
                
                for j, primitive in enumerate(mesh.get('primitives', [])):
                    # Get vertex count
                    if 'POSITION' in primitive.get('attributes', {}):
                        pos_accessor_idx = primitive['attributes']['POSITION']
                        accessor = gltf['accessors'][pos_accessor_idx]
                        vertex_count = accessor['count']
                        total_vertices += vertex_count
                        
                        print(f"    Primitive {j}:")
                        print(f"      Vertices: {vertex_count:,}")
                        
                        # Check for attributes
                        attrs = primitive.get('attributes', {})
                        print(f"      Attributes: {', '.join(attrs.keys())}")
                        
                        # Get triangle count
                        if 'indices' in primitive:
                            indices_accessor_idx = primitive['indices']
                            indices_accessor = gltf['accessors'][indices_accessor_idx]
                            index_count = indices_accessor['count']
                            triangle_count = index_count // 3
                            total_triangles += triangle_count
                            print(f"      Triangles: {triangle_count:,}")
                        
                        # Check material
                        if 'material' in primitive:
                            mat_idx = primitive['material']
                            mat_name = gltf['materials'][mat_idx].get('name', f'Material_{mat_idx}')
                            print(f"      Material: {mat_name}")
            
            print()
            print("=" * 60)
            print("📈 TOTALS:")
            print(f"  Total Vertices: {total_vertices:,}")
            print(f"  Total Triangles: {total_triangles:,}")
            print()
            
            # Provide recommendations
            print("💡 RIGGING RECOMMENDATIONS:")
            print()
            
            if total_vertices > 100000:
                print("  ⚠️  HIGH POLY COUNT - Retopology strongly recommended")
                print("     Target: 10,000-30,000 vertices for game characters")
                print("     Target: 30,000-80,000 vertices for film/high-quality")
            elif total_vertices > 50000:
                print("  ⚠️  MEDIUM-HIGH POLY - Consider retopology for better performance")
            else:
                print("  ✅ Poly count is reasonable for rigging")
            
            print()
            
            if not has_skin:
                print("  📋 NEXT STEPS:")
                print("     1. Import into Blender")
                print("     2. Perform retopology (if needed)")
                print("     3. Add armature/skeleton")
                print("     4. Skin weights (weight painting)")
                print("     5. Test deformations")
                print()
                print("  🚀 QUICK OPTIONS:")
                print("     • Try Mixamo auto-rigging (upload directly)")
                print("     • Use Blender's Rigify addon")
                print("     • Manual rigging in your preferred 3D software")
            else:
                print("  ✅ Model already has a skeleton!")
                if has_animations:
                    print("  ✅ Model already has animations!")
                else:
                    print("  ℹ️  Add animations in your 3D software")
            
            print()
            print("=" * 60)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python analyze_mesh.py <path_to_glb_file>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    
    if not Path(filepath).exists():
        print(f"❌ File not found: {filepath}")
        sys.exit(1)
    
    analyze_glb(filepath)
