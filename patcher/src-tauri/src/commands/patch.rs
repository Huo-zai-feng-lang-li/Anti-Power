// 补丁安装与卸载模块

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::embedded;

const FEATURE_DEFAULTS_VERSION: u32 = 1;

/// 提示词增强配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PromptEnhanceConfig {
    pub enabled: bool,
    pub provider: String,
    #[serde(rename = "apiBase")]
    pub api_base: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: String,
}

const DEFAULT_SYSTEM_PROMPT: &str = "你是一个智能提示词优化器，专门帮助用户生成更有效的 AI 对话提示词。\n\n## 核心任务\n将用户输入的原始提示词优化为更清晰、更具体、更有效的版本。\n\n## 你会收到的信息\n1. **对话上下文**：之前的对话历史（如果有）\n2. **当前文件**：用户正在编辑的文件（如果有）\n3. **选中代码**：用户选中的代码片段（如果有）\n4. **用户原始提示词**：需要优化的内容\n\n## 优化规则\n1. **理解上下文**：仔细阅读对话历史，理解当前讨论的主题和背景\n2. **保持连贯性**：优化后的提示词应该与之前的对话保持逻辑连贯\n3. **具体化**：让模糊的问题变得具体，如果上下文中有相关信息就引用它\n4. **结构化**：为复杂问题添加清晰的结构，使用 Markdown 列表\n5. **保持意图**：不改变用户的原始意图，只是表达得更清晰\n6. **保留格式**：必须使用 Markdown 格式（换行、列表、代码块），确保生成的提示词易于阅读\n\n## 输出要求\n- **只输出优化后的提示词**，不要任何解释、前缀或额外内容\n- 保持用户使用的语言（中文/英文）\n- 如果原始提示词是追问或继续之前的话题，保持这种连续性\n- **关键**：确保输出包含必要的换行符，不要将长文本压缩成一行\n\n## 示例\n\n### 示例 1 - 无上下文\n输入: hi\n输出: 你好，请帮我解决一个问题。我会详细描述需求，请提供完整的解决方案。\n\n### 示例 2 - 有上下文（之前讨论了一个 bug）\n对话历史: [用户问了如何修复登录 bug，AI 提供了方案]\n输入: 还有问题\n输出: 按照你之前提供的登录 bug 修复方案，我尝试后发现仍有问题。请帮我进一步排查，可能是哪些原因导致的？\n\n### 示例 3 - 引用代码\n选中代码: function getData() { ... }\n输入: 优化这个\n输出: 请帮我优化上面选中的 getData 函数。具体需要：\n1. 提高性能\n2. 改进可读性\n3. 添加错误处理\n\n请解释每处修改的原因。\n\n记住：直接输出优化后的提示词，不要任何其他内容。";

impl Default for PromptEnhanceConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            provider: "openai".to_string(),
            api_base: "https://tokenrhythm.studio/v1".to_string(),
            api_key: String::new(),
            model: "deepseek-v4-flash".to_string(),
            system_prompt: DEFAULT_SYSTEM_PROMPT.to_string(),
        }
    }
}

/// 侧边栏功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureConfig {
    #[serde(rename = "featureDefaultsVersion")]
    pub feature_defaults_version: u32,
    /// 是否启用侧边栏补丁 (禁用时还原所有侧边栏相关文件)
    pub enabled: bool,
    #[serde(rename = "scrollToBottom")]
    pub scroll_to_bottom: bool,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    #[serde(rename = "sidePaddingLeft")]
    pub side_padding_left: f32,
    #[serde(rename = "sidePaddingRight")]
    pub side_padding_right: f32,
    /// 提示词增强配置
    #[serde(rename = "promptEnhance")]
    pub prompt_enhance: PromptEnhanceConfig,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            feature_defaults_version: FEATURE_DEFAULTS_VERSION,
            enabled: true,
            scroll_to_bottom: true,
            font_size_enabled: false,
            font_size: 14.0,
            side_padding_left: 8.0,
            side_padding_right: 3.0,
            prompt_enhance: PromptEnhanceConfig::default(),
        }
    }
}

/// Manager 窗口功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct ManagerFeatureConfig {
    #[serde(rename = "featureDefaultsVersion")]
    pub feature_defaults_version: u32,
    /// 是否启用 Manager 补丁 (禁用时还原所有 Manager 相关文件)
    pub enabled: bool,
    #[serde(rename = "scrollToBottom")]
    pub scroll_to_bottom: bool,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    /// 提示词增强配置
    #[serde(rename = "promptEnhance")]
    pub prompt_enhance: PromptEnhanceConfig,
}

impl Default for ManagerFeatureConfig {
    fn default() -> Self {
        Self {
            feature_defaults_version: FEATURE_DEFAULTS_VERSION,
            enabled: true,
            scroll_to_bottom: true,
            font_size_enabled: false,
            font_size: 16.0,
            prompt_enhance: PromptEnhanceConfig::default(),
        }
    }
}

/// 安装补丁
#[tauri::command]
pub fn install_patch(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    // 侧边栏目标目录
    let extensions_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity");

    // Manager 目标目录
    let workbench_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    if !workbench_dir.exists() {
        return Err("Manager 窗口目录不存在".to_string());
    }

    // 根据 enabled 状态处理侧边栏补丁
    if features.enabled {
        // 备份并安装侧边栏补丁（extensions + workbench 双路径写入文件）
        backup_cascade_files(&extensions_dir)?;
        write_cascade_patches(&extensions_dir, &workbench_dir, &features)?;
    } else {
        // 禁用时还原侧边栏文件
        restore_cascade_files(&extensions_dir)?;
    }

    // 根据 enabled 状态处理 Manager 补丁
    if manager_features.enabled {
        // 备份并安装 Manager 补丁
        backup_manager_files(&workbench_dir)?;
        write_manager_patches(&workbench_dir, &manager_features)?;
        
        // 清空 product.json 的 checksums 字段，消除"安装损坏"提示
        let product_json_path = antigravity_path
            .join("resources")
            .join("app")
            .join("product.json");
        clear_product_checksums(&product_json_path)?;
    } else {
        // 禁用时还原 Manager 文件
        restore_manager_files(&workbench_dir)?;
    }

    let proxy_enabled = features.prompt_enhance.enabled || manager_features.prompt_enhance.enabled;
    sync_launchpad_proxy(&workbench_dir, proxy_enabled)?;

    // 最后注入 cascade 到 workbench.html（必须在 manager 覆盖之后）
    if features.enabled {
        let workbench_html = workbench_dir.join("workbench.html");
        if workbench_html.exists() {
            inject_cascade_into_html(&workbench_html)?;
        }
    }

    Ok(())
}

/// 卸载补丁 (恢复原版)
#[tauri::command]
pub fn uninstall_patch(path: String) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    let extensions_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity");

    let workbench_dir = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench");

    if !extensions_dir.exists() {
        return Err("无效的 Antigravity 安装目录".to_string());
    }

    // 恢复备份文件
    restore_backup_files(&extensions_dir, &workbench_dir)?;

    Ok(())
}

/// 仅更新配置文件 (不重新复制补丁文件)
#[tauri::command]
pub fn update_config(
    path: String, 
    features: FeatureConfig,
    manager_features: ManagerFeatureConfig
) -> Result<(), String> {
    let antigravity_path = PathBuf::from(&path);
    
    // 侧边栏配置
    let cascade_config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !cascade_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        return Err("补丁尚未安装，请先安装补丁".to_string());
    }

    write_config_file(&cascade_config_path, &features)?;

    let workbench_cascade_config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("cascade-panel")
        .join("config.json");

    if workbench_cascade_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        write_config_file(&workbench_cascade_config_path, &features)?;
    }

    // Manager 配置
    let manager_config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    if manager_config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        write_manager_config_file(&manager_config_path, &manager_features)?;
    }

    Ok(())
}

/// 检测补丁是否已安装
#[tauri::command]
pub fn check_patch_status(path: String) -> Result<bool, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    // 如果 config.json 存在, 则认为补丁已安装
    Ok(config_path.exists())
}

/// 读取已安装的补丁配置
#[tauri::command]
pub fn read_patch_config(path: String) -> Result<Option<FeatureConfig>, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("extensions")
        .join("antigravity")
        .join("cascade-panel")
        .join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置失败: {}", e))?;

    let raw: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {}", e))?;
    let is_legacy_config = raw.get("featureDefaultsVersion").is_none();
    let mut config: FeatureConfig = serde_json::from_value(raw)
        .map_err(|e| format!("解析配置失败: {}", e))?;
    if is_legacy_config {
        config.feature_defaults_version = 0;
    }
    
    Ok(Some(config))
}

/// 读取已安装的 Manager 补丁配置
#[tauri::command]
pub fn read_manager_patch_config(path: String) -> Result<Option<ManagerFeatureConfig>, String> {
    let antigravity_path = PathBuf::from(&path);
    
    let config_path = antigravity_path
        .join("resources")
        .join("app")
        .join("out")
        .join("vs")
        .join("code")
        .join("electron-browser")
        .join("workbench")
        .join("manager-panel")
        .join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Manager 配置失败: {}", e))?;

    let raw: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Manager 配置失败: {}", e))?;
    let is_legacy_config = raw.get("featureDefaultsVersion").is_none();
    let mut config: ManagerFeatureConfig = serde_json::from_value(raw)
        .map_err(|e| format!("解析 Manager 配置失败: {}", e))?;
    if is_legacy_config {
        config.feature_defaults_version = 0;
    }
    
    Ok(Some(config))
}

/// 备份侧边栏相关文件
fn backup_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_panel.exists() && !cascade_backup.exists() {
        fs::copy(&cascade_panel, &cascade_backup)
            .map_err(|e| format!("备份 cascade-panel.html 失败: {}", e))?;
    }
    Ok(())
}

/// 备份 Manager 相关文件
fn backup_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    // 备份 workbench-jetski-agent.html
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_agent.exists() && !jetski_backup.exists() {
        fs::copy(&jetski_agent, &jetski_backup)
            .map_err(|e| format!("备份 workbench-jetski-agent.html 失败: {}", e))?;
    }

    // 备份 workbench.html
    let workbench_html = workbench_dir.join("workbench.html");
    let workbench_backup = workbench_dir.join("workbench.html.bak");
    if workbench_html.exists() && !workbench_backup.exists() {
        fs::copy(&workbench_html, &workbench_backup)
            .map_err(|e| format!("备份 workbench.html 失败: {}", e))?;
    }
    Ok(())
}

/// 将 cascade CSS + JS 注入到 HTML 文件（幂等，不处理 .bak）
fn inject_cascade_into_html(html_path: &PathBuf) -> Result<(), String> {
    let content = fs::read_to_string(html_path)
        .map_err(|e| format!("读取 HTML 失败: {}", e))?;
    let mut result = content;

    // TrustedTypes bypass
    let marker = "[Antigravity-Power-Pro] Cascade Inject";
    if !result.contains(marker) {
        let tt_bypass = format!(
            "<script>\n/* {} */\nif(window.trustedTypes&&!window.trustedTypes.defaultPolicy){{try{{window.trustedTypes.createPolicy(\"default\",{{createHTML:s=>s,createScript:s=>s,createScriptURL:s=>s}})}}catch(e){{}}}}\n</script>",
            marker
        );
        result = result.replacen("<head>", &format!("<head>{}", tt_bypass), 1);
    }

    // Keep repeated installs idempotent even when older templates used a different tag spelling.
    for tag in [
        "<link rel=\"stylesheet\" href=\"./cascade-panel/cascade-panel.css\">",
        "<link rel=\"stylesheet\" href=\"./cascade-panel/cascade-panel.css\"/>",
        "<link rel=\"stylesheet\" href=\"./cascade-panel/cascade-panel.css\" />",
    ] {
        result = result.replace(tag, "");
    }

    for tag in [
        "<script src=\"./cascade-panel/cascade-panel.js\" type=\"module\"></script>",
        "<script type=\"module\" src=\"./cascade-panel/cascade-panel.js\"></script>",
    ] {
        result = result.replace(tag, "");
    }

    // CSS
    let css_tag = "<link rel=\"stylesheet\" href=\"./cascade-panel/cascade-panel.css\">";
    result = result.replacen("</head>", &format!("{}</head>", css_tag), 1);

    // JS
    let js_tag = "<script src=\"./cascade-panel/cascade-panel.js\" type=\"module\"></script>";
    result = result.replacen("</body>", &format!("{}</body>", js_tag), 1);

    fs::write(html_path, result)
        .map_err(|e| format!("写入 HTML 失败: {}", e))?;
    Ok(())
}

const LAUNCHPAD_PROXY_MARKER_START: &str =
    "<!-- [Antigravity-Power-Pro] Launchpad Proxy -->";
const LAUNCHPAD_PROXY_MARKER_END: &str =
    "<!-- [Antigravity-Power-Pro] Launchpad Proxy End -->";
const LAUNCHPAD_PROXY_SCRIPT: &str =
    "<script src=\"./shared/launchpad-proxy.js\" type=\"module\"></script>";

fn remove_launchpad_proxy_block(content: &str) -> String {
    let mut cleaned = content.to_string();
    loop {
        let Some(start) = cleaned.find(LAUNCHPAD_PROXY_MARKER_START) else {
            break;
        };
        let end = if let Some(end_offset) =
            cleaned[start..].find(LAUNCHPAD_PROXY_MARKER_END)
        {
            start + end_offset + LAUNCHPAD_PROXY_MARKER_END.len()
        } else if let Some(script_offset) = cleaned[start..].find(LAUNCHPAD_PROXY_SCRIPT) {
            start + script_offset + LAUNCHPAD_PROXY_SCRIPT.len()
        } else {
            break;
        };
        let mut end = end;
        if cleaned[end..].starts_with("\r\n") {
            end += 2;
        } else if cleaned[end..].starts_with('\n') {
            end += 1;
        }
        cleaned = format!("{}{}", &cleaned[..start], &cleaned[end..]);
    }
    cleaned
}

fn sync_launchpad_proxy_content(content: &str, enabled: bool) -> Result<String, String> {
    let cleaned = remove_launchpad_proxy_block(content);
    if !enabled {
        return Ok(cleaned);
    }

    let block = format!(
        "{}\n{}\n{}\n",
        LAUNCHPAD_PROXY_MARKER_START, LAUNCHPAD_PROXY_SCRIPT, LAUNCHPAD_PROXY_MARKER_END
    );
    let lower = cleaned.to_ascii_lowercase();
    let Some(head_end) = lower.find("</head>") else {
        return Err("Launchpad 页面缺少 </head>，无法注入代理".to_string());
    };
    Ok(format!(
        "{}{}{}",
        &cleaned[..head_end], block, &cleaned[head_end..]
    ))
}

fn sync_launchpad_proxy(workbench_dir: &PathBuf, enabled: bool) -> Result<(), String> {
    let html_path = workbench_dir.join("workbench-jetski-agent.html");
    let content = fs::read_to_string(&html_path)
        .map_err(|e| format!("读取 Launchpad 页面失败: {}", e))?;
    let updated = sync_launchpad_proxy_content(&content, enabled)?;
    fs::write(&html_path, updated).map_err(|e| format!("写入 Launchpad 代理失败: {}", e))?;
    if !enabled {
        let bridge_page = workbench_dir.join("launchpad-bridge.html");
        if bridge_page.exists() {
            fs::remove_file(&bridge_page)
                .map_err(|e| format!("删除 Launchpad 桥接页失败: {}", e))?;
        }
    }
    Ok(())
}

/// 写入侧边栏补丁文件（extensions 目录 + workbench 目录双路径注入）
fn write_cascade_patches(extensions_dir: &PathBuf, workbench_dir: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");
    let wb_cascade_dir = workbench_dir.join("cascade-panel");
    let wb_shared_dir = workbench_dir.join("shared");

    // 清理旧目录
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir)
            .map_err(|e| format!("删除旧 cascade-panel 目录失败: {}", e))?;
    }
    if wb_cascade_dir.exists() {
        fs::remove_dir_all(&wb_cascade_dir)
            .map_err(|e| format!("删除 workbench cascade-panel 目录失败: {}", e))?;
    }
    if wb_shared_dir.exists() {
        fs::remove_dir_all(&wb_shared_dir)
            .map_err(|e| format!("删除 workbench shared 目录失败: {}", e))?;
    }

    fs::create_dir_all(&cascade_panel_dir)
        .map_err(|e| format!("创建 cascade-panel 目录失败: {}", e))?;
    fs::create_dir_all(&wb_cascade_dir)
        .map_err(|e| format!("创建 workbench cascade-panel 目录失败: {}", e))?;
    fs::create_dir_all(&wb_shared_dir)
        .map_err(|e| format!("创建 workbench shared 目录失败: {}", e))?;

    // 写入补丁文件到两个目录
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        let is_cascade = relative_path == "cascade-panel.html"
            || relative_path == "launchpad-bridge.html"
            || relative_path.starts_with("cascade-panel/")
            || relative_path.starts_with("shared/");
        if !is_cascade {
            continue;
        }

        // 写到 extensions 目录
        let ext_path = extensions_dir.join(&relative_path);
        if let Some(p) = ext_path.parent() { fs::create_dir_all(p).ok(); }
        fs::write(&ext_path, &content)
            .map_err(|e| format!("写入 extensions 失败 {:?}: {}", ext_path, e))?;

        // cascade-panel/ 同步写到 workbench 目录
        if relative_path.starts_with("cascade-panel/") {
            let wb_path = workbench_dir.join(&relative_path);
            if let Some(p) = wb_path.parent() { fs::create_dir_all(p).ok(); }
            fs::write(&wb_path, &content)
                .map_err(|e| format!("写入 workbench 失败 {:?}: {}", wb_path, e))?;
        }
        if relative_path.starts_with("shared/") {
            let wb_path = workbench_dir.join(&relative_path);
            if let Some(p) = wb_path.parent() { fs::create_dir_all(p).ok(); }
            fs::write(&wb_path, &content).ok();
        }
        if relative_path == "launchpad-bridge.html" {
            let wb_path = workbench_dir.join(&relative_path);
            fs::write(&wb_path, &content)
                .map_err(|e| format!("写入 Launchpad 桥接页失败 {:?}: {}", wb_path, e))?;
        }
    }

    // 生成配置文件（两处）
    let cascade_config_path = cascade_panel_dir.join("config.json");
    write_config_file(&cascade_config_path, features)?;
    let wb_cascade_config = wb_cascade_dir.join("config.json");
    write_config_file(&wb_cascade_config, features)?;

    // 注意: workbench.html 注入已移到 install_patch 末尾执行（在 manager 覆盖之后）
    Ok(())
}

/// 写入 Manager 补丁文件
fn write_manager_patches(workbench_dir: &PathBuf, manager_features: &ManagerFeatureConfig) -> Result<(), String> {
    let manager_panel_dir = workbench_dir.join("manager-panel");
    let shared_dir = workbench_dir.join("shared");
    
    // 先删除旧目录, 确保文件结构干净
    if manager_panel_dir.exists() {
        fs::remove_dir_all(&manager_panel_dir)
            .map_err(|e| format!("删除旧 manager-panel 目录失败: {}", e))?;
    }
    if shared_dir.exists() {
        fs::remove_dir_all(&shared_dir)
            .map_err(|e| format!("删除旧 shared 目录失败: {}", e))?;
    }
    
    // 创建目录
    fs::create_dir_all(&manager_panel_dir)
        .map_err(|e| format!("创建 manager-panel 目录失败: {}", e))?;
    fs::create_dir_all(&shared_dir)
        .map_err(|e| format!("创建 shared 目录失败: {}", e))?;
    
    // 写入 Manager 相关补丁文件
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        // 只处理 Manager 相关文件 (Antigravity 用 workbench-antigravity.html 覆盖 workbench.html)
        if relative_path != "workbench-jetski-agent.html" && 
           relative_path != "workbench-antigravity.html" &&
           relative_path != "launchpad-bridge.html" &&
           !relative_path.starts_with("manager-panel/") &&
           !relative_path.starts_with("shared/") {
            continue;
        }
        
        let target_name = if relative_path == "workbench-antigravity.html" {
            "workbench.html"
        } else {
            &relative_path
        };

        let full_path = workbench_dir.join(target_name);
        
        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        
        fs::write(&full_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", full_path, e))?;
    }
    
    // 生成 Manager 配置文件
    let manager_config_path = manager_panel_dir.join("config.json");
    write_manager_config_file(&manager_config_path, manager_features)?;

    Ok(())
}

/// 侧边栏配置文件生成
fn write_config_file(config_path: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "featureDefaultsVersion": FEATURE_DEFAULTS_VERSION,
        "scrollToBottom": features.scroll_to_bottom,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size,
        "sidePaddingLeft": clamp_side_padding(features.side_padding_left),
        "sidePaddingRight": clamp_side_padding(features.side_padding_right),
        "promptEnhance": {
            "enabled": features.prompt_enhance.enabled,
            "provider": features.prompt_enhance.provider,
            "apiBase": features.prompt_enhance.api_base,
            "apiKey": features.prompt_enhance.api_key,
            "model": features.prompt_enhance.model,
            "systemPrompt": features.prompt_enhance.system_prompt
        }
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入侧边栏配置失败: {}", e))?;
    
    Ok(())
}

fn clamp_side_padding(value: f32) -> f32 {
    value.clamp(0.0, 48.0)
}

/// Manager 配置文件生成
fn write_manager_config_file(config_path: &PathBuf, features: &ManagerFeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "featureDefaultsVersion": FEATURE_DEFAULTS_VERSION,
        "scrollToBottom": features.scroll_to_bottom,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size,
        "promptEnhance": {
            "enabled": features.prompt_enhance.enabled,
            "provider": features.prompt_enhance.provider,
            "apiBase": features.prompt_enhance.api_base,
            "apiKey": features.prompt_enhance.api_key,
            "model": features.prompt_enhance.model,
            "systemPrompt": features.prompt_enhance.system_prompt
        }
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入 Manager 配置失败: {}", e))?;
    
    Ok(())
}

/// 恢复侧边栏文件 (禁用补丁时调用)
fn restore_cascade_files(extensions_dir: &PathBuf) -> Result<(), String> {
    // 恢复 cascade-panel.html
    let cascade_panel = extensions_dir.join("cascade-panel.html");
    let cascade_backup = extensions_dir.join("cascade-panel.html.bak");
    if cascade_backup.exists() {
        fs::copy(&cascade_backup, &cascade_panel)
            .map_err(|e| format!("恢复 cascade-panel.html 失败: {}", e))?;
    }

    // 删除侧边栏补丁目录
    let cascade_dir = extensions_dir.join("cascade-panel");
    if cascade_dir.exists() {
        fs::remove_dir_all(&cascade_dir)
            .map_err(|e| format!("删除 cascade-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// 恢复 Manager 文件 (禁用补丁时调用)
fn restore_manager_files(workbench_dir: &PathBuf) -> Result<(), String> {
    // 恢复 workbench-jetski-agent.html
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_backup.exists() {
        fs::copy(&jetski_backup, &jetski_agent)
            .map_err(|e| format!("恢复 workbench-jetski-agent.html 失败: {}", e))?;
    }

    // 恢复 workbench.html
    let workbench_html = workbench_dir.join("workbench.html");
    let workbench_backup = workbench_dir.join("workbench.html.bak");
    if workbench_backup.exists() {
        fs::copy(&workbench_backup, &workbench_html)
            .map_err(|e| format!("恢复 workbench.html 失败: {}", e))?;
    }

    // 删除 Manager 补丁目录
    let manager_dir = workbench_dir.join("manager-panel");
    if manager_dir.exists() {
        fs::remove_dir_all(&manager_dir)
            .map_err(|e| format!("删除 manager-panel 目录失败: {}", e))?;
    }

    if jetski_agent.exists() {
        sync_launchpad_proxy(workbench_dir, false)?;
    }

    Ok(())
}

/// 恢复所有备份文件 (完全卸载时调用)
fn restore_backup_files(extensions_dir: &PathBuf, workbench_dir: &PathBuf) -> Result<(), String> {
    restore_cascade_files(extensions_dir)?;
    restore_manager_files(workbench_dir)?;
    Ok(())
}

// ============================================
// Windsurf IDE 补丁
// ============================================

/// Windsurf 功能配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct WindsurfFeatureConfig {
    #[serde(rename = "featureDefaultsVersion")]
    pub feature_defaults_version: u32,
    #[serde(rename = "scrollToBottom")]
    pub scroll_to_bottom: bool,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    #[serde(rename = "promptEnhance")]
    pub prompt_enhance: PromptEnhanceConfig,
}

impl Default for WindsurfFeatureConfig {
    fn default() -> Self {
        Self {
            feature_defaults_version: FEATURE_DEFAULTS_VERSION,
            scroll_to_bottom: true,
            font_size_enabled: false,
            font_size: 14.0,
            prompt_enhance: PromptEnhanceConfig::default(),
        }
    }
}

/// 安装 Windsurf 补丁
#[tauri::command]
pub fn install_windsurf_patch(path: String, features: WindsurfFeatureConfig) -> Result<(), String> {
    let windsurf_path = PathBuf::from(&path);
    let workbench_dir = windsurf_path
        .join("resources").join("app").join("out")
        .join("vs").join("code").join("electron-browser").join("workbench");

    if !workbench_dir.exists() {
        return Err("无效的 Windsurf 安装目录".to_string());
    }

    backup_windsurf_files(&workbench_dir)?;
    write_windsurf_patches(&workbench_dir, &features)?;

    let product_json = windsurf_path
        .join("resources").join("app").join("product.json");
    clear_product_checksums(&product_json)?;

    Ok(())
}

/// 卸载 Windsurf 补丁
#[tauri::command]
pub fn uninstall_windsurf_patch(path: String) -> Result<(), String> {
    let windsurf_path = PathBuf::from(&path);
    let workbench_dir = windsurf_path
        .join("resources").join("app").join("out")
        .join("vs").join("code").join("electron-browser").join("workbench");

    if !workbench_dir.exists() {
        return Err("无效的 Windsurf 安装目录".to_string());
    }

    restore_windsurf_files(&workbench_dir)?;

    // 恢复 product.json 备份
    let product_json = windsurf_path
        .join("resources").join("app").join("product.json");
    let product_backup = product_json.with_extension("json.bak");
    if product_backup.exists() {
        fs::copy(&product_backup, &product_json)
            .map_err(|e| format!("恢复 product.json 失败: {}", e))?;
        fs::remove_file(&product_backup)
            .map_err(|e| format!("删除 product.json 备份失败: {}", e))?;
    }

    Ok(())
}

/// 更新 Windsurf 配置
#[tauri::command]
pub fn update_windsurf_config(path: String, features: WindsurfFeatureConfig) -> Result<(), String> {
    let windsurf_path = PathBuf::from(&path);
    let config_path = windsurf_path
        .join("resources").join("app").join("out")
        .join("vs").join("code").join("electron-browser").join("workbench")
        .join("windsurf-panel").join("config.json");

    if !config_path.parent().map(|p| p.exists()).unwrap_or(false) {
        return Err("Windsurf 补丁尚未安装".to_string());
    }

    write_windsurf_config_file(&config_path, &features)?;
    Ok(())
}

/// 检测 Windsurf 补丁状态
#[tauri::command]
pub fn check_windsurf_patch_status(path: String) -> Result<bool, String> {
    let windsurf_path = PathBuf::from(&path);
    let config_path = windsurf_path
        .join("resources").join("app").join("out")
        .join("vs").join("code").join("electron-browser").join("workbench")
        .join("windsurf-panel").join("config.json");

    Ok(config_path.exists())
}

/// 读取 Windsurf 补丁配置
#[tauri::command]
pub fn read_windsurf_patch_config(path: String) -> Result<Option<WindsurfFeatureConfig>, String> {
    let windsurf_path = PathBuf::from(&path);
    let config_path = windsurf_path
        .join("resources").join("app").join("out")
        .join("vs").join("code").join("electron-browser").join("workbench")
        .join("windsurf-panel").join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 Windsurf 配置失败: {}", e))?;
    let raw: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Windsurf 配置失败: {}", e))?;
    let is_legacy_config = raw.get("featureDefaultsVersion").is_none();
    let mut config: WindsurfFeatureConfig = serde_json::from_value(raw)
        .map_err(|e| format!("解析 Windsurf 配置失败: {}", e))?;
    if is_legacy_config {
        config.feature_defaults_version = 0;
    }
    Ok(Some(config))
}

/// 备份 Windsurf workbench.html
fn backup_windsurf_files(workbench_dir: &PathBuf) -> Result<(), String> {
    let workbench_html = workbench_dir.join("workbench.html");
    let backup = workbench_dir.join("workbench.html.bak");
    if workbench_html.exists() && !backup.exists() {
        fs::copy(&workbench_html, &backup)
            .map_err(|e| format!("备份 workbench.html 失败: {}", e))?;
    }
    Ok(())
}

/// 写入 Windsurf 补丁文件
fn write_windsurf_patches(workbench_dir: &PathBuf, features: &WindsurfFeatureConfig) -> Result<(), String> {
    let panel_dir = workbench_dir.join("windsurf-panel");
    let shared_dir = workbench_dir.join("shared");

    if panel_dir.exists() {
        fs::remove_dir_all(&panel_dir)
            .map_err(|e| format!("删除旧 windsurf-panel 目录失败: {}", e))?;
    }
    if shared_dir.exists() {
        fs::remove_dir_all(&shared_dir)
            .map_err(|e| format!("删除旧 shared 目录失败: {}", e))?;
    }
    fs::create_dir_all(&panel_dir)
        .map_err(|e| format!("创建 windsurf-panel 目录失败: {}", e))?;
    fs::create_dir_all(&shared_dir)
        .map_err(|e| format!("创建 shared 目录失败: {}", e))?;

    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        if relative_path != "workbench-windsurf.html"
            && !relative_path.starts_with("windsurf-panel/")
            && !relative_path.starts_with("shared/")
        {
            continue;
        }

        // workbench-windsurf.html 写入为 workbench.html
        let target_path = if relative_path == "workbench-windsurf.html" {
            workbench_dir.join("workbench.html")
        } else {
            workbench_dir.join(&relative_path)
        };

        if let Some(parent) = target_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }

        fs::write(&target_path, content)
            .map_err(|e| format!("写入文件失败 {:?}: {}", target_path, e))?;
    }

    let config_path = panel_dir.join("config.json");
    write_windsurf_config_file(&config_path, features)?;

    Ok(())
}

/// 写入 Windsurf 配置文件
fn write_windsurf_config_file(config_path: &PathBuf, features: &WindsurfFeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "featureDefaultsVersion": FEATURE_DEFAULTS_VERSION,
        "scrollToBottom": features.scroll_to_bottom,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size,
        "promptEnhance": {
            "enabled": features.prompt_enhance.enabled,
            "provider": features.prompt_enhance.provider,
            "apiBase": features.prompt_enhance.api_base,
            "apiKey": features.prompt_enhance.api_key,
            "model": features.prompt_enhance.model,
            "systemPrompt": features.prompt_enhance.system_prompt
        }
    });

    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入 Windsurf 配置失败: {}", e))?;
    Ok(())
}

/// 恢复 Windsurf 文件
fn restore_windsurf_files(workbench_dir: &PathBuf) -> Result<(), String> {
    let workbench_html = workbench_dir.join("workbench.html");
    let backup = workbench_dir.join("workbench.html.bak");
    if backup.exists() {
        fs::copy(&backup, &workbench_html)
            .map_err(|e| format!("恢复 workbench.html 失败: {}", e))?;
        fs::remove_file(&backup)
            .map_err(|e| format!("删除备份失败: {}", e))?;
    }

    let panel_dir = workbench_dir.join("windsurf-panel");
    if panel_dir.exists() {
        fs::remove_dir_all(&panel_dir)
            .map_err(|e| format!("删除 windsurf-panel 目录失败: {}", e))?;
    }

    Ok(())
}

/// 清空 product.json 的 checksums 字段
/// 
/// Antigravity 启动时会校验文件的 checksums，修改 workbench-jetski-agent.html 后
/// 校验和不匹配会导致"安装似乎损坏"提示。清空 checksums 字段可以绕过此校验。
fn clear_product_checksums(product_json_path: &PathBuf) -> Result<(), String> {
    if !product_json_path.exists() {
        // product.json 不存在时跳过，不报错
        return Ok(());
    }

    // 备份 product.json（仅首次）
    let backup_path = product_json_path.with_extension("json.bak");
    if !backup_path.exists() {
        fs::copy(product_json_path, &backup_path)
            .map_err(|e| format!("备份 product.json 失败: {}", e))?;
    }

    // 读取并解析 JSON (跳过 UTF-8 BOM)
    let content = fs::read_to_string(product_json_path)
        .map_err(|e| format!("读取 product.json 失败: {}", e))?;
    let content = content.trim_start_matches('\u{feff}');
    
    let mut json: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("解析 product.json 失败: {}", e))?;

    // 清空 checksums 字段
    if let Some(obj) = json.as_object_mut() {
        if obj.contains_key("checksums") {
            obj.insert("checksums".to_string(), serde_json::json!({}));
            
            // 写回文件（保持格式化）
            let formatted = serde_json::to_string_pretty(&json)
                .map_err(|e| format!("序列化 product.json 失败: {}", e))?;
            
            fs::write(product_json_path, formatted)
                .map_err(|e| format!("写入 product.json 失败: {}", e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod launchpad_proxy_tests {
    use super::sync_launchpad_proxy_content;

    #[test]
    fn injects_launchpad_proxy_once() {
        let html = "<html><head></head><body><div>keep</div></body></html>";

        let injected = sync_launchpad_proxy_content(html, true).unwrap();
        let reinjected = sync_launchpad_proxy_content(&injected, true).unwrap();

        assert_eq!(injected, reinjected);
        assert_eq!(injected.matches("./shared/launchpad-proxy.js").count(), 1);
    }

    #[test]
    fn disabling_removes_only_the_owned_proxy_block() {
        let html = "<html><head><meta charset=\"utf-8\"></head><body><div>keep</div></body></html>";
        let injected = sync_launchpad_proxy_content(html, true).unwrap();

        let restored = sync_launchpad_proxy_content(&injected, false).unwrap();

        assert_eq!(restored, html);
        assert!(restored.contains("<div>keep</div>"));
    }

    #[test]
    fn handles_case_insensitive_head_and_removes_duplicate_blocks() {
        let html = "<html><HEAD></HEAD><body>keep</body></html>";
        let injected = sync_launchpad_proxy_content(html, true).unwrap();
        let duplicate_block = "<!-- [Antigravity-Power-Pro] Launchpad Proxy -->\n<script src=\"./shared/launchpad-proxy.js\" type=\"module\"></script>\n<!-- [Antigravity-Power-Pro] Launchpad Proxy End -->";
        let duplicated = injected.replacen("</HEAD>", &format!("{}\n</HEAD>", duplicate_block), 1);

        let restored = sync_launchpad_proxy_content(&duplicated, false).unwrap();

        assert_eq!(restored, "<html><HEAD></HEAD><body>keep</body></html>");
    }

    #[test]
    fn rejects_enabled_injection_without_head() {
        let result = sync_launchpad_proxy_content("<html><body>keep</body></html>", true);

        assert!(result.is_err());
    }
}
