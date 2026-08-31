import os
import sys
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.reports.registry import registry

sources = registry.list_sources()
print(f"Checking {len(sources)} registered sources for relation nodes with empty children...", flush=True)

empty_children_nodes = []

def check_nodes(nodes, source_key):
    for node in nodes:
        if node.get('type') in ('relation', 'reverse_relation'):
            children = node.get('children', [])
            if not children:
                empty_children_nodes.append((source_key, node['path'], node['type'], node['label']))
            else:
                check_nodes(children, source_key)

for s in sources:
    tree = registry.get_field_tree(s['key'])
    check_nodes(tree, s['key'])

print(f"Total relation nodes with EMPTY children: {len(empty_children_nodes)}")
for src, path, ntype, label in empty_children_nodes:
    print(f"  - [{src}] Path: '{path}' | Type: '{ntype}' | Label: '{label}'")
