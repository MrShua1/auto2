const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const home=os.homedir();
const auto=path.resolve(__dirname,'..');
const dest=path.join(home,'Desktop/Auto D');
const modules={'cinematic-director':'cinematic-director','story-director':'ai-short-film-director','storyboard-director':'cinematic-storyboard-director','keyframe-storyboard':'gpt-10s-nine-grid-storyboard'};
for(const [module,skill] of Object.entries(modules)){
  const src=path.join(home,'Desktop/skills',skill);
  const target=path.join(auto,'modules',module);
  for(const name of fs.readdirSync(src)){
    if(['node_modules','.git','__pycache__'].includes(name))continue;
    fs.cpSync(path.join(src,name),path.join(target,name==='SKILL.md'?'SOURCE-SKILL.md':name),{recursive:true,dereference:true});
  }
  fs.writeFileSync(path.join(target,'MODULE.md'),`# ${module} Internal Module\n\nRead SOURCE-SKILL.md and the bundled relative resources only for the active stage.\nAuto D rules, user locks, material integration, attempt limits and approval gates\noverride historical standalone instructions. Never load another external skill.\n`);
}
// Refresh only the release's own maintained source files; never copy secrets or project data.
fs.cpSync(auto,path.join(dest,'skills/auto'),{recursive:true,dereference:true});
for(const name of ['install-auto-d.cjs','check-auto-d.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(dest,name));
fs.copyFileSync(path.join(home,'.config/opencode/AGENTS.md'),path.join(dest,'user-preferences.md'));
console.log('Completed eight internal skill modules and refreshed Auto D rules.');
