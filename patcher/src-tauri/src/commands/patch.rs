// 补丁安装与卸载模块

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::embedded;

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

impl Default for PromptEnhanceConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "anthropic".to_string(),
            api_base: "https://api.anthropic.com".to_string(),
            api_key: String::new(),
            model: "claude-sonnet-4-20250514".to_string(),
            system_prompt: String::new(),
        }
    }
}

/// 侧边栏功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct FeatureConfig {
    /// 是否启用侧边栏补丁 (禁用时还原所有侧边栏相关文件)
    pub enabled: bool,
    pub mermaid: bool,
    pub math: bool,
    #[serde(rename = "copyButton")]
    pub copy_button: bool,
    #[serde(rename = "tableColor")]
    pub table_color: bool,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
    /// 提示词增强配置
    #[serde(rename = "promptEnhance")]
    pub prompt_enhance: PromptEnhanceConfig,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            mermaid: true,
            math: true,
            copy_button: true,
            table_color: true,
            font_size_enabled: true,
            font_size: 20.0,
            prompt_enhance: PromptEnhanceConfig::default(),
        }
    }
}

/// Manager 窗口功能开关配置
#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct ManagerFeatureConfig {
    /// 是否启用 Manager 补丁 (禁用时还原所有 Manager 相关文件)
    pub enabled: bool,
    pub mermaid: bool,
    pub math: bool,
    #[serde(rename = "copyButton")]
    pub copy_button: bool,
    #[serde(rename = "maxWidthEnabled")]
    pub max_width_enabled: bool,
    #[serde(rename = "maxWidthRatio")]
    pub max_width_ratio: f32,
    #[serde(rename = "fontSizeEnabled")]
    pub font_size_enabled: bool,
    #[serde(rename = "fontSize")]
    pub font_size: f32,
}

impl Default for ManagerFeatureConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mermaid: false,
            math: false,
            copy_button: true,
            max_width_enabled: false,
            max_width_ratio: 75.0,
            font_size_enabled: false,
            font_size: 16.0,
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
        // 备份并安装侧边栏补丁
        backup_cascade_files(&extensions_dir)?;
        write_cascade_patches(&extensions_dir, &features)?;
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
    
    let config: FeatureConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {}", e))?;
    
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
    
    let config: ManagerFeatureConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Manager 配置失败: {}", e))?;
    
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
    let jetski_agent = workbench_dir.join("workbench-jetski-agent.html");
    let jetski_backup = workbench_dir.join("workbench-jetski-agent.html.bak");
    if jetski_agent.exists() && !jetski_backup.exists() {
        fs::copy(&jetski_agent, &jetski_backup)
            .map_err(|e| format!("备份 workbench-jetski-agent.html 失败: {}", e))?;
    }
    Ok(())
}

/// 写入侧边栏补丁文件
fn write_cascade_patches(extensions_dir: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let cascade_panel_dir = extensions_dir.join("cascade-panel");
    
    // 先删除旧目录, 确保文件结构干净
    if cascade_panel_dir.exists() {
        fs::remove_dir_all(&cascade_panel_dir)
            .map_err(|e| format!("删除旧 cascade-panel 目录失败: {}", e))?;
    }
    
    // 创建目录
    fs::create_dir_all(&cascade_panel_dir)
        .map_err(|e| format!("创建 cascade-panel 目录失败: {}", e))?;
    
    // 写入侧边栏相关补丁文件
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        // 只处理侧边栏相关文件
        if relative_path != "cascade-panel.html" && !relative_path.starts_with("cascade-panel/") {
            continue;
        }
        
        let full_path = extensions_dir.join(&relative_path);
        
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
    
    // 生成侧边栏配置文件
    let cascade_config_path = cascade_panel_dir.join("config.json");
    write_config_file(&cascade_config_path, features)?;

    Ok(())
}

/// 写入 Manager 补丁文件
fn write_manager_patches(workbench_dir: &PathBuf, manager_features: &ManagerFeatureConfig) -> Result<(), String> {
    let manager_panel_dir = workbench_dir.join("manager-panel");
    
    // 先删除旧目录, 确保文件结构干净
    if manager_panel_dir.exists() {
        fs::remove_dir_all(&manager_panel_dir)
            .map_err(|e| format!("删除旧 manager-panel 目录失败: {}", e))?;
    }
    
    // 创建目录
    fs::create_dir_all(&manager_panel_dir)
        .map_err(|e| format!("创建 manager-panel 目录失败: {}", e))?;
    
    // 写入 Manager 相关补丁文件
    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        // 只处理 Manager 相关文件
        if relative_path != "workbench-jetski-agent.html" && !relative_path.starts_with("manager-panel/") {
            continue;
        }
        
        let full_path = workbench_dir.join(&relative_path);
        
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

/// 写入侧边栏配置文件
fn write_config_file(config_path: &PathBuf, features: &FeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "tableColor": features.table_color,
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
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    Ok(())
}

/// 写入 Manager 配置文件
fn write_manager_config_file(config_path: &PathBuf, features: &ManagerFeatureConfig) -> Result<(), String> {
    let config_content = serde_json::json!({
        "mermaid": features.mermaid,
        "math": features.math,
        "copyButton": features.copy_button,
        "maxWidthEnabled": features.max_width_enabled,
        "maxWidthRatio": features.max_width_ratio,
        "fontSizeEnabled": features.font_size_enabled,
        "fontSize": features.font_size
    });
    
    fs::write(config_path, serde_json::to_string_pretty(&config_content).unwrap())
        .map_err(|e| format!("写入 Manager 配置文件失败: {}", e))?;
    
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

    // 删除 Manager 补丁目录
    let manager_dir = workbench_dir.join("manager-panel");
    if manager_dir.exists() {
        fs::remove_dir_all(&manager_dir)
            .map_err(|e| format!("删除 manager-panel 目录失败: {}", e))?;
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
    #[serde(rename = "scrollToBottom")]
    pub scroll_to_bottom: bool,
    #[serde(rename = "promptEnhance")]
    pub prompt_enhance: PromptEnhanceConfig,
}

impl Default for WindsurfFeatureConfig {
    fn default() -> Self {
        Self {
            scroll_to_bottom: true,
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
    let config: WindsurfFeatureConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析 Windsurf 配置失败: {}", e))?;
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

    if panel_dir.exists() {
        fs::remove_dir_all(&panel_dir)
            .map_err(|e| format!("删除旧 windsurf-panel 目录失败: {}", e))?;
    }
    fs::create_dir_all(&panel_dir)
        .map_err(|e| format!("创建 windsurf-panel 目录失败: {}", e))?;

    let patch_files = embedded::get_all_files_runtime()?;
    for (relative_path, content) in patch_files {
        if relative_path != "workbench-windsurf.html" && !relative_path.starts_with("windsurf-panel/") {
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
        "scrollToBottom": features.scroll_to_bottom,
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
