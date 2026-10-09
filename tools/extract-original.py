"""Extract original Unity/Utage tables, then rebuild the watch data and images."""
import sys,json,argparse
from pathlib import Path
import UnityPy
from importlib.util import spec_from_file_location,module_from_spec

p=argparse.ArgumentParser()
p.add_argument('--game-data',type=Path,required=True,help='The original Unity *_Data directory')
p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
a=p.parse_args()
bundle=a.game_data/'StreamingAssets/hoshishiro/Windows-patch/星空鉄道とシロの旅.scenarios.asset'
if not bundle.is_file():raise SystemExit('Original scenario bundle not found: '+str(bundle))
probe=a.project/'.extracted';probe.mkdir(parents=True,exist_ok=True)
env=UnityPy.load(str(bundle));book=None;settings=None
for obj in env.objects:
 if obj.type.name!='MonoBehaviour':continue
 tree=obj.read_typetree()
 if 'importGridList' in tree:book=tree
 if 'settingList' in tree:settings=tree
if book is None or settings is None:raise SystemExit('This game version does not contain the expected Utage tables')
(probe/'scenarios.asset_-2507898223139034885.json').write_text(json.dumps(book,ensure_ascii=False),encoding='utf-8')
(probe/'scenarios.asset_1416801050685970231.json').write_text(json.dumps(settings,ensure_ascii=False),encoding='utf-8')
spec=spec_from_file_location('converter',Path(__file__).with_name('convert-game.py'))
module=module_from_spec(spec);spec.loader.exec_module(module);module.convert(probe,a.project)
import subprocess
subprocess.run([sys.executable,str(Path(__file__).with_name('export-images.py')),'--game-data',str(a.game_data),'--project',str(a.project)],check=True)
